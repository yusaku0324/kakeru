from pathlib import Path
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.templating import Jinja2Templates

from ..deps import require_admin


templates = Jinja2Templates(directory=Path(__file__).resolve().parent / "templates")
static_dir = Path(__file__).resolve().parent / "static"


router = APIRouter(
    prefix="/admin/htmx",
    tags=["admin_htmx"],
    dependencies=[Depends(require_admin)],
)


def _filter_rows(q: str | None) -> List[dict]:
    data = [
        {"name": "Alice", "status": "active", "next": "Today 12:00"},
        {"name": "Bob", "status": "pending", "next": "Today 15:30"},
        {"name": "Carol", "status": "inactive", "next": "Tomorrow 10:00"},
    ]
    if not q:
        return data
    q_lower = q.lower()
    return [
        row
        for row in data
        if q_lower in row["name"].lower() or q_lower in row["status"].lower()
    ]


@router.get("/dashboard", response_class=HTMLResponse)
async def dashboard(request: Request, q: str | None = None):
    rows = _filter_rows(q)
    return templates.TemplateResponse(
        "dashboard.html",
        {
            "request": request,
            "rows": rows,
            "query": q or "",
        },
    )


@router.get("/dashboard/table", response_class=HTMLResponse)
async def dashboard_table(request: Request, q: str | None = None):
    rows = _filter_rows(q)
    return templates.TemplateResponse(
        "dashboard_table.html",
        {
            "request": request,
            "rows": rows,
            "query": q or "",
        },
    )


@router.get("/static/{path:path}")
async def admin_htmx_static(path: str):
    file_path = static_dir / path
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="static file not found")
    return FileResponse(file_path)


# Shifts
from .views import shifts as shifts_views  # noqa: E402

router.include_router(shifts_views.router)
