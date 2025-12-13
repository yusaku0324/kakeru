from fastapi.testclient import TestClient

from app.deps import require_admin
from app.main import app


def test_admin_htmx_dashboard_renders_html():
    app.dependency_overrides[require_admin] = lambda: None
    client = TestClient(app)

    resp = client.get("/admin/htmx/shifts")

    app.dependency_overrides = {}

    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/html")
    assert "hx-post" in resp.text or "hx-get" in resp.text
