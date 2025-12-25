#!/usr/bin/env python3
"""Generate static API documentation from OpenAPI schema."""

import asyncio
import json
import os
from pathlib import Path

# Add parent directory to path to import the app
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app
from app.openapi_config import custom_openapi


HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Osakamenesu API Documentation</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui.css">
    <style>
        body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        .topbar {
            background-color: #1b1b1b;
            padding: 10px 20px;
            color: white;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .topbar h1 {
            margin: 0;
            font-size: 24px;
        }
        .topbar .links {
            display: flex;
            gap: 20px;
        }
        .topbar a {
            color: white;
            text-decoration: none;
            padding: 5px 10px;
            border-radius: 4px;
            transition: background-color 0.2s;
        }
        .topbar a:hover {
            background-color: #333;
        }
        #swagger-ui {
            padding: 20px;
        }
        .swagger-ui .topbar {
            display: none;
        }
    </style>
</head>
<body>
    <div class="topbar">
        <h1>🔍 Osakamenesu API Documentation</h1>
        <div class="links">
            <a href="#" onclick="switchToSwagger()">Swagger UI</a>
            <a href="#" onclick="switchToRedoc()">ReDoc</a>
            <a href="/docs">Interactive Docs</a>
            <a href="/redoc">Live ReDoc</a>
        </div>
    </div>
    <div id="swagger-ui"></div>
    <div id="redoc-container" style="display: none;"></div>

    <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-bundle.js"></script>
    <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-standalone-preset.js"></script>
    <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>

    <script>
        const spec = OPENAPI_SCHEMA_PLACEHOLDER;

        // Initialize Swagger UI
        const ui = SwaggerUIBundle({
            spec: spec,
            dom_id: '#swagger-ui',
            deepLinking: true,
            presets: [
                SwaggerUIBundle.presets.apis,
                SwaggerUIStandalonePreset
            ],
            plugins: [
                SwaggerUIBundle.plugins.DownloadUrl
            ],
            layout: "StandaloneLayout",
            persistAuthorization: true,
            filter: true,
            tryItOutEnabled: true,
            supportedSubmitMethods: ['get', 'post', 'put', 'delete', 'patch'],
            onComplete: () => {
                console.log("Swagger UI loaded");
            }
        });

        window.ui = ui;

        function switchToSwagger() {
            document.getElementById('swagger-ui').style.display = 'block';
            document.getElementById('redoc-container').style.display = 'none';
        }

        function switchToRedoc() {
            document.getElementById('swagger-ui').style.display = 'none';
            document.getElementById('redoc-container').style.display = 'block';

            // Initialize ReDoc if not already done
            if (!document.getElementById('redoc-container').hasChildNodes()) {
                Redoc.init(spec, {
                    scrollYOffset: 50,
                    hideDownloadButton: false,
                    disableSearch: false,
                    theme: {
                        colors: {
                            primary: {
                                main: '#1976d2'
                            }
                        },
                        typography: {
                            fontSize: '14px',
                            code: {
                                fontSize: '13px',
                                fontFamily: 'Consolas, Monaco, monospace'
                            }
                        }
                    }
                }, document.getElementById('redoc-container'));
            }
        }
    </script>
</body>
</html>"""


REDOC_HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Osakamenesu API Documentation - ReDoc</title>
    <style>
        body {
            margin: 0;
            padding: 0;
        }
    </style>
</head>
<body>
    <redoc spec-url="openapi.json"></redoc>
    <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
</body>
</html>"""


async def generate_docs():
    """Generate static API documentation files."""
    # Create output directory
    output_dir = Path("api-docs")
    output_dir.mkdir(exist_ok=True)

    # Generate OpenAPI schema
    openapi_schema = custom_openapi(app)

    # Save OpenAPI schema as JSON
    schema_path = output_dir / "openapi.json"
    with open(schema_path, "w", encoding="utf-8") as f:
        json.dump(openapi_schema, f, ensure_ascii=False, indent=2)

    print(f"✅ OpenAPI schema saved to: {schema_path}")

    # Generate HTML with embedded schema
    html_content = HTML_TEMPLATE.replace(
        "OPENAPI_SCHEMA_PLACEHOLDER", json.dumps(openapi_schema)
    )

    # Save combined HTML
    html_path = output_dir / "index.html"
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html_content)

    print(f"✅ API documentation HTML saved to: {html_path}")

    # Save ReDoc HTML
    redoc_path = output_dir / "redoc.html"
    with open(redoc_path, "w", encoding="utf-8") as f:
        f.write(REDOC_HTML_TEMPLATE)

    print(f"✅ ReDoc HTML saved to: {redoc_path}")

    # Generate markdown documentation
    await generate_markdown_docs(openapi_schema, output_dir)


async def generate_markdown_docs(schema: dict, output_dir: Path):
    """Generate markdown documentation from OpenAPI schema."""
    md_content = f"""# {schema.get("info", {}).get("title", "API Documentation")}

Version: {schema.get("info", {}).get("version", "1.0.0")}

{schema.get("info", {}).get("description", "")}

## Endpoints

"""

    # Group endpoints by tags
    endpoints_by_tag = {}
    for path, methods in schema.get("paths", {}).items():
        for method, operation in methods.items():
            if method in ["get", "post", "put", "patch", "delete"]:
                tags = operation.get("tags", ["other"])
                for tag in tags:
                    if tag not in endpoints_by_tag:
                        endpoints_by_tag[tag] = []
                    endpoints_by_tag[tag].append(
                        {"path": path, "method": method.upper(), "operation": operation}
                    )

    # Write endpoints by tag
    for tag, endpoints in sorted(endpoints_by_tag.items()):
        # Find tag description
        tag_info = next((t for t in schema.get("tags", []) if t["name"] == tag), {})
        md_content += f"\n### {tag_info.get('name', tag).upper()}\n"
        if tag_info.get("description"):
            md_content += f"{tag_info['description']}\n\n"

        for endpoint in endpoints:
            operation = endpoint["operation"]
            md_content += f"\n#### {endpoint['method']} {endpoint['path']}\n"
            md_content += f"{operation.get('summary', 'No summary')}\n\n"

            if operation.get("description"):
                md_content += f"{operation['description']}\n\n"

            # Parameters
            params = operation.get("parameters", [])
            if params:
                md_content += "**Parameters:**\n\n"
                for param in params:
                    required = "required" if param.get("required") else "optional"
                    md_content += f"- `{param['name']}` ({param['in']}, {required}): {param.get('description', 'No description')}\n"
                md_content += "\n"

            # Request body
            if operation.get("requestBody"):
                md_content += "**Request Body:**\n\n"
                content = operation["requestBody"].get("content", {})
                if "application/json" in content:
                    schema_ref = content["application/json"].get("schema", {})
                    if "$ref" in schema_ref:
                        md_content += f"See schema: {schema_ref['$ref']}\n\n"
                    else:
                        md_content += "```json\n"
                        md_content += json.dumps(schema_ref, indent=2)
                        md_content += "\n```\n\n"

            # Responses
            responses = operation.get("responses", {})
            if responses:
                md_content += "**Responses:**\n\n"
                for status_code, response in responses.items():
                    md_content += f"- `{status_code}`: {response.get('description', 'No description')}\n"
                md_content += "\n"

    # Save markdown
    md_path = output_dir / "api-reference.md"
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(md_content)

    print(f"✅ Markdown documentation saved to: {md_path}")


if __name__ == "__main__":
    asyncio.run(generate_docs())
