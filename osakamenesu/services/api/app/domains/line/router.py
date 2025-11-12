from __future__ import annotations

from fastapi import APIRouter, Depends, Request, Response, status

from ...utils.proxy import require_proxy_signature

router = APIRouter(prefix="/api/line", tags=["line"])


@router.post("/webhook", status_code=status.HTTP_204_NO_CONTENT)
async def line_webhook(
    request: Request,
    _verified: None = Depends(require_proxy_signature),
) -> Response:
    # Webhook payload is forwarded via Next.js proxy.
    # At this stage the application does not implement business logic yet,
    # but we ensure the body is fully consumed for future extension.
    await request.body()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/ping")
async def line_ping(_verified: None = Depends(require_proxy_signature)) -> dict[str, str]:
    return {"ok": "line-proxy"}


__all__ = ["router"]

