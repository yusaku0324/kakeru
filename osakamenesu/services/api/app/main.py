from contextlib import asynccontextmanager

import logging
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .admin_htmx.router import router as admin_htmx_router
from .meili import ensure_indexes
from .settings import settings
from .domains.admin import (
    admin_router,
    admin_profiles_router,
)
from .domains.async_tasks.router import router as async_tasks_router
from .domains.auth import router as auth_router
from .domains.dashboard import (
    managers_router as dashboard_managers_router,
    notifications_router as dashboard_notifications_router,
    reservations_router as dashboard_reservations_router,
    reviews_router as dashboard_reviews_router,
    shifts_router as dashboard_shifts_router,
    shops_router as dashboard_shops_router,
    therapists_router as dashboard_therapists_router,
)
from .domains.line import router as line_router
from .domains.ops import router as ops_router
from .domains.site import (
    favorites_router,
    guest_matching_router,
    guest_reservations_router,
    shops_router,
    therapist_availability_router,
    therapists_router,
)
from .domains.test import router as test_router
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from .db import get_session
from . import models


app_logger = logging.getLogger("app")
if not app_logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(message)s"))
    app_logger.addHandler(handler)
app_logger.setLevel(logging.INFO)
app_logger.propagate = False


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger = logging.getLogger("app.startup")

    if settings.init_db_on_startup:
        try:
            from .db import init_db

            await init_db()
        except Exception as exc:  # pragma: no cover - defensive logging
            logger.warning("DB init error: %s", exc)

    try:
        ensure_indexes()
    except Exception as exc:  # pragma: no cover - defensive logging
        logger.warning("Meili init error: %s", exc)

    logger.info(
        "Notifications worker runs outside the API process. Start it via `python -m app.scripts.notifications_worker`.",
    )

    yield

    # Shutdown all rate limiters
    from .rate_limiters import shutdown_all_rate_limiters

    await shutdown_all_rate_limiters()


app = FastAPI(title="Osaka Men-Esu API", version="0.1.0", lifespan=lifespan)

# Import rate limiters after app is created to avoid circular imports
from .rate_limiters import outlink_rate as _outlink_rate

_cors_origins = {
    settings.api_origin,
    "http://localhost:3000",
    "http://127.0.0.1:3000",
}

if settings.site_base_url:
    origin = settings.site_base_url.rstrip("/")
    if origin:
        _cors_origins.add(origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(_cors_origins),
    allow_credentials=True,
    # セキュリティ: 必要なHTTPメソッドとヘッダーのみ許可
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=[
        "Accept",
        "Accept-Language",
        "Content-Type",
        "Authorization",
        "X-Admin-Key",
        "X-CSRF-Token",
        "X-Requested-With",
        "Cookie",
    ],
)

media_backend = getattr(settings, "media_storage_backend", "memory")
if media_backend and media_backend.lower() == "local":
    media_root = settings.media_root
    media_root.mkdir(parents=True, exist_ok=True)
    mount_path = settings.media_url_prefix
    if not mount_path.startswith("/"):
        mount_path = f"/{mount_path}"
    app.mount(mount_path, StaticFiles(directory=str(media_root)), name="media")


@app.get("/healthz")
async def healthz():
    return {"ok": True}


@app.get("/api/out/{token}")
async def out_redirect(
    token: str, request: Request, db: AsyncSession = Depends(get_session)
):
    """Resolve outlink token from DB and redirect. Optionally logs a click."""
    from fastapi.responses import RedirectResponse
    import hashlib

    res = await db.execute(select(models.Outlink).where(models.Outlink.token == token))
    ol = res.scalar_one_or_none()
    if not ol:
        raise HTTPException(status_code=404, detail="unknown token")

    # Rate limit per token+ip to mitigate abuse
    try:
        ip = request.headers.get(
            "x-forwarded-for", request.client.host if request.client else ""
        )
        key = f"{token}:{ip}"
        allowed, retry_after = await _outlink_rate.allow(key)
        if not allowed:
            raise HTTPException(status_code=429, detail="too many requests")
        # Best-effort click logging (non-blocking)
        import hashlib

        ip_hash = hashlib.sha256(ip.encode("utf-8")).hexdigest() if ip else None
        referer = request.headers.get("referer")
        ua = request.headers.get("user-agent")
        click = models.Click(outlink_id=ol.id, referer=referer, ua=ua, ip_hash=ip_hash)
        db.add(click)
        await db.commit()
    except Exception:
        pass

    return RedirectResponse(ol.target_url, status_code=302)


app.include_router(admin_profiles_router)
app.include_router(admin_router)
app.include_router(admin_htmx_router)
app.include_router(shops_router)
app.include_router(guest_matching_router)
app.include_router(guest_reservations_router)
app.include_router(therapist_availability_router)
app.include_router(auth_router)
app.include_router(favorites_router)
app.include_router(async_tasks_router)
app.include_router(line_router)
app.include_router(ops_router)
app.include_router(dashboard_managers_router)
app.include_router(dashboard_notifications_router)
app.include_router(dashboard_reservations_router)
app.include_router(dashboard_reviews_router)
app.include_router(dashboard_shifts_router)
app.include_router(dashboard_shops_router)
app.include_router(dashboard_therapists_router)
app.include_router(therapists_router)
app.include_router(test_router)
