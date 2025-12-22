"""Router for shop manager management."""

from __future__ import annotations

import logging
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .... import models
from ....db import get_session
from ....deps import require_dashboard_user, verify_shop_manager
from ....settings import settings
from ....utils.email import send_email_async, MailNotConfiguredError
from .schemas import (
    AddShopManagerRequest,
    AddShopManagerResponse,
    DeleteShopManagerResponse,
    ShopManagerItem,
    ShopManagerListResponse,
    UpdateShopManagerRequest,
    UpdateShopManagerResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/dashboard", tags=["dashboard-managers"])

ROLE_LABELS = {
    "owner": "オーナー",
    "manager": "マネージャー",
    "staff": "スタッフ",
}


async def _send_invitation_email(
    email: str,
    shop_name: str,
    role: str,
    inviter_name: str | None,
) -> None:
    """Send an invitation email to the new manager."""
    role_label = ROLE_LABELS.get(role, role)
    inviter_text = f"（{inviter_name} さんからの招待）" if inviter_name else ""

    dashboard_url = (
        f"{settings.site_base_url or settings.api_public_base_url}/dashboard/login"
    )

    subject = f"【大阪メンエス】{shop_name} のスタッフに招待されました"

    html = f"""
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>{shop_name} へようこそ</h2>
        <p>
            あなたは <strong>{shop_name}</strong> の<strong>{role_label}</strong>として招待されました。{inviter_text}
        </p>
        <p>
            以下のリンクからダッシュボードにログインして、店舗の管理を始めてください。
        </p>
        <p style="margin: 24px 0;">
            <a href="{dashboard_url}"
               style="display: inline-block; background: #000; color: #fff; padding: 12px 24px;
                      text-decoration: none; border-radius: 4px;">
                ダッシュボードにログイン
            </a>
        </p>
        <p style="color: #666; font-size: 14px;">
            ログインにはメールアドレス認証（マジックリンク）を使用します。
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
        <p style="color: #999; font-size: 12px;">
            このメールに心当たりがない場合は、無視していただいて構いません。
        </p>
    </div>
    """

    text = f"""
{shop_name} へようこそ

あなたは {shop_name} の{role_label}として招待されました。{inviter_text}

以下のリンクからダッシュボードにログインして、店舗の管理を始めてください。

{dashboard_url}

ログインにはメールアドレス認証（マジックリンク）を使用します。

---
このメールに心当たりがない場合は、無視していただいて構いません。
    """.strip()

    try:
        await send_email_async(
            to=email,
            subject=subject,
            html=html,
            text=text,
            tags=["staff-invitation"],
        )
        logger.info(
            "invitation_email_sent",
            extra={"email": email, "shop_name": shop_name, "role": role},
        )
    except MailNotConfiguredError:
        logger.warning("invitation_email_skipped_mail_not_configured")
    except Exception as exc:
        logger.error(
            "invitation_email_failed",
            extra={"email": email, "error": str(exc)},
        )


async def _require_owner_role(
    db: AsyncSession, user_id: UUID, shop_id: UUID
) -> models.ShopManager:
    """Require the user to be an owner of the shop."""
    result = await db.execute(
        select(models.ShopManager).where(
            models.ShopManager.shop_id == shop_id,
            models.ShopManager.user_id == user_id,
        )
    )
    manager = result.scalar_one_or_none()
    if not manager or manager.role != "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="owner_required",
        )
    return manager


@router.get(
    "/shops/{shop_id}/managers",
    response_model=ShopManagerListResponse,
)
async def list_shop_managers(
    shop_id: UUID,
    db: AsyncSession = Depends(get_session),
    user: models.User = Depends(require_dashboard_user),
) -> ShopManagerListResponse:
    """List all managers for a shop."""
    await verify_shop_manager(db, user.id, shop_id)

    result = await db.execute(
        select(models.ShopManager, models.User)
        .join(models.User, models.ShopManager.user_id == models.User.id)
        .where(models.ShopManager.shop_id == shop_id)
        .order_by(models.ShopManager.created_at)
    )
    rows = result.all()

    managers = [
        ShopManagerItem(
            id=sm.id,
            user_id=sm.user_id,
            email=u.email,
            display_name=u.display_name,
            role=sm.role,
            created_at=sm.created_at,
        )
        for sm, u in rows
    ]

    return ShopManagerListResponse(managers=managers)


@router.post(
    "/shops/{shop_id}/managers",
    response_model=AddShopManagerResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_shop_manager(
    shop_id: UUID,
    payload: AddShopManagerRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_session),
    user: models.User = Depends(require_dashboard_user),
) -> AddShopManagerResponse:
    """Add a new manager to a shop. Only owners can add managers."""
    await _require_owner_role(db, user.id, shop_id)

    # Check if shop exists
    shop = await db.get(models.Profile, shop_id)
    if not shop:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="shop_not_found",
        )

    # Find or create user by email
    result = await db.execute(
        select(models.User).where(models.User.email == payload.email)
    )
    target_user = result.scalar_one_or_none()
    user_created = False

    if not target_user:
        target_user = models.User(email=payload.email)
        db.add(target_user)
        await db.flush()
        user_created = True

    # Check if already a manager
    existing = await db.execute(
        select(models.ShopManager).where(
            models.ShopManager.shop_id == shop_id,
            models.ShopManager.user_id == target_user.id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="already_manager",
        )

    # Create shop manager
    new_manager = models.ShopManager(
        shop_id=shop_id,
        user_id=target_user.id,
        role=payload.role,
    )
    db.add(new_manager)
    await db.commit()
    await db.refresh(new_manager)
    await db.refresh(target_user)

    # Send invitation email in background
    background_tasks.add_task(
        _send_invitation_email,
        email=target_user.email,
        shop_name=shop.name,
        role=payload.role,
        inviter_name=user.display_name,
    )

    return AddShopManagerResponse(
        id=new_manager.id,
        user_id=target_user.id,
        email=target_user.email,
        display_name=target_user.display_name,
        role=new_manager.role,
        created_at=new_manager.created_at,
        user_created=user_created,
    )


@router.patch(
    "/shops/{shop_id}/managers/{manager_id}",
    response_model=UpdateShopManagerResponse,
)
async def update_shop_manager(
    shop_id: UUID,
    manager_id: UUID,
    payload: UpdateShopManagerRequest,
    db: AsyncSession = Depends(get_session),
    user: models.User = Depends(require_dashboard_user),
) -> UpdateShopManagerResponse:
    """Update a manager's role. Only owners can update managers."""
    await _require_owner_role(db, user.id, shop_id)

    # Get the manager to update
    manager = await db.get(models.ShopManager, manager_id)
    if not manager or manager.shop_id != shop_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="manager_not_found",
        )

    # Prevent demoting the last owner
    if manager.role == "owner" and payload.role != "owner":
        result = await db.execute(
            select(models.ShopManager).where(
                models.ShopManager.shop_id == shop_id,
                models.ShopManager.role == "owner",
            )
        )
        owners = result.scalars().all()
        if len(owners) == 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="cannot_demote_last_owner",
            )

    manager.role = payload.role
    await db.commit()
    await db.refresh(manager)

    # Get user info
    target_user = await db.get(models.User, manager.user_id)

    return UpdateShopManagerResponse(
        id=manager.id,
        user_id=manager.user_id,
        email=target_user.email,
        display_name=target_user.display_name,
        role=manager.role,
    )


@router.delete(
    "/shops/{shop_id}/managers/{manager_id}",
    response_model=DeleteShopManagerResponse,
)
async def delete_shop_manager(
    shop_id: UUID,
    manager_id: UUID,
    db: AsyncSession = Depends(get_session),
    user: models.User = Depends(require_dashboard_user),
) -> DeleteShopManagerResponse:
    """Remove a manager from a shop. Only owners can remove managers."""
    await _require_owner_role(db, user.id, shop_id)

    # Get the manager to delete
    manager = await db.get(models.ShopManager, manager_id)
    if not manager or manager.shop_id != shop_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="manager_not_found",
        )

    # Prevent removing the last owner
    if manager.role == "owner":
        result = await db.execute(
            select(models.ShopManager).where(
                models.ShopManager.shop_id == shop_id,
                models.ShopManager.role == "owner",
            )
        )
        owners = result.scalars().all()
        if len(owners) == 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="cannot_remove_last_owner",
            )

    await db.delete(manager)
    await db.commit()

    return DeleteShopManagerResponse(
        deleted=True,
        message="manager_removed",
    )
