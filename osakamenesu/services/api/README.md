## admin_htmx について

- 管理/内部向け UI は FastAPI + htmx + Jinja2 で構成し、`/admin/htmx` 配下に集約します。
- これらの UI は apps/web (React/Next) とは完全に分離し、コンポーネントや状態を共有しません。
- apps/web への htmx 混在や、新規 React 画面の追加は行いません。
