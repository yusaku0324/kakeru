from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from ... import models
from ...db import get_session
from ...schemas import Reservation as ReservationSchema, ReservationCreateRequest
from ...settings import settings
from ..admin.reservations import _ensure_shop, _reservation_to_schema


router = APIRouter(prefix="/api/test", tags=["test"], include_in_schema=False)


async def require_test_secret(x_test_auth_secret: str = Header(...)) -> None:
  expected = settings.test_auth_secret
  if not expected or x_test_auth_secret != expected:
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="invalid test secret")


@router.post("/reservations", response_model=ReservationSchema, status_code=status.HTTP_201_CREATED)
async def create_test_reservation(
  payload: ReservationCreateRequest,
  db: AsyncSession = Depends(get_session),
  _: None = Depends(require_test_secret),
):
  if payload.desired_end <= payload.desired_start:
    raise HTTPException(status_code=400, detail="desired_end must be after desired_start")

  await _ensure_shop(db, payload.shop_id)

  reservation = models.Reservation(
    shop_id=payload.shop_id,
    staff_id=payload.staff_id,
    menu_id=payload.menu_id,
    channel=payload.channel,
    desired_start=payload.desired_start,
    desired_end=payload.desired_end,
    notes=payload.notes,
    marketing_opt_in=bool(payload.marketing_opt_in),
    customer_name=payload.customer.name,
    customer_phone=payload.customer.phone,
    customer_email=payload.customer.email,
    customer_line_id=payload.customer.line_id,
    customer_remark=payload.customer.remark,
  )
  if not reservation.status:
    reservation.status = "pending"
  reservation.status_events.append(
    models.ReservationStatusEvent(
      status=reservation.status,
      changed_at=datetime.now(timezone.utc),
      changed_by="system",
      note=None,
    )
  )

  db.add(reservation)
  await db.commit()
  await db.refresh(reservation, attribute_names=["status_events", "preferred_slots"])

  return _reservation_to_schema(reservation)
