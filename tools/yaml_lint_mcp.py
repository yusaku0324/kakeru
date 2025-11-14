#!/usr/bin/env python3
"""
Minimal MCP server that exposes a single `yamllint` tool.

This allows Codex / MCP-compatible clients to lint YAML content either from a
file path or direct string input. Responses use the MCP stdio transport.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from typing import Any, Dict

CONTENT_HEADER = "Content-Length"
DOUBLE_CRLF = b"\r\n\r\n"


def read_message() -> dict[str, Any] | None:
    """Read a JSON-RPC message from stdin (stdio transport)."""
    buffer = b""
    while DOUBLE_CRLF not in buffer:
        chunk = sys.stdin.buffer.read(1)
        if not chunk:
            return None
        buffer += chunk

    header_bytes, remainder = buffer.split(DOUBLE_CRLF, 1)
    content_length = 0
    for line in header_bytes.decode().split("\r\n"):
        if line.lower().startswith(CONTENT_HEADER.lower()):
            _, value = line.split(":", 1)
            content_length = int(value.strip())
            break

    body = remainder
    while len(body) < content_length:
        chunk = sys.stdin.buffer.read(content_length - len(body))
        if not chunk:
            return None
        body += chunk

    return json.loads(body.decode())


def send_message(payload: dict[str, Any]) -> None:
    body = json.dumps(payload)
    header = f"{CONTENT_HEADER}: {len(body)}\r\n\r\n"
    sys.stdout.write(header + body)
    sys.stdout.flush()


def yamllint_available() -> bool:
    try:
        subprocess.run(["yamllint", "--version"], check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return True
    except FileNotFoundError:
        return False


def lint_yaml(arguments: Dict[str, Any]) -> str:
    if not yamllint_available():
        raise RuntimeError("yamllint is not installed. Install it with `pip install yamllint`.")

    path = arguments.get("path")
    content = arguments.get("content")
    config = arguments.get("config")

    cmd = ["yamllint", "-f", "parsable"]
    if config:
        cmd.extend(["-c", config])

    if content is not None:
        proc = subprocess.run(
            cmd + ["-"],
            input=content,
            text=True,
            capture_output=True,
        )
    elif path:
        if not os.path.exists(path):
            raise FileNotFoundError(f"File not found: {path}")
        proc = subprocess.run(
            cmd + [path],
            text=True,
            capture_output=True,
        )
    else:
        raise ValueError("Either 'path' or 'content' must be provided.")

    output = proc.stdout.strip()
    error = proc.stderr.strip()
    if proc.returncode == 0:
        return output or "No lint issues found."
    combined = "\n".join([line for line in (output, error) if line])
    return combined or "yamllint reported a failure with no output."


TOOLS = [
    {
        "name": "yamllint",
        "description": "Lint YAML content using yamllint.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "Path to a YAML file to lint.",
                },
                "content": {
                    "type": "string",
                    "description": "YAML content to lint (when no path is provided).",
                },
                "config": {
                    "type": "string",
                    "description": "Optional yamllint configuration file path.",
                },
            },
            "anyOf": [
                {"required": ["path"]},
                {"required": ["content"]},
            ],
        },
    }
]


def handle_initialize(message: dict[str, Any]) -> None:
    response = {
        "jsonrpc": "2.0",
        "id": message.get("id"),
        "result": {
            "capabilities": {
                "tools": {},
            }
        },
    }
    send_message(response)


def handle_list_tools(message: dict[str, Any]) -> None:
    response = {
        "jsonrpc": "2.0",
        "id": message.get("id"),
        "result": {
            "tools": TOOLS,
        },
    }
    send_message(response)


def handle_call_tool(message: dict[str, Any]) -> None:
    params = message.get("params") or {}
    name = params.get("name")
    arguments = params.get("arguments") or {}

    if name != "yamllint":
        response = {
            "jsonrpc": "2.0",
            "id": message.get("id"),
            "error": {
                "code": -32601,
                "message": f"Unsupported tool '{name}'.",
            },
        }
        send_message(response)
        return

    try:
        result_text = lint_yaml(arguments)
        response = {
            "jsonrpc": "2.0",
            "id": message.get("id"),
            "result": {
                "content": [
                    {
                        "type": "text",
                        "text": result_text,
                    }
                ]
            },
        }
    except Exception as exc:
        response = {
            "jsonrpc": "2.0",
            "id": message.get("id"),
            "error": {
                "code": -32000,
                "message": str(exc),
            },
        }
    send_message(response)


def main() -> None:
    while True:
        message = read_message()
        if message is None:
            break

        method = message.get("method")
        if method == "initialize":
            handle_initialize(message)
        elif method == "tools/list":
            handle_list_tools(message)
        elif method == "call_tool":
            handle_call_tool(message)
        elif method in {"shutdown", "exit"}:
            break
        else:
            response = {
                "jsonrpc": "2.0",
                "id": message.get("id"),
                "error": {
                    "code": -32601,
                    "message": f"Unsupported method '{method}'.",
                },
            }
            send_message(response)


if __name__ == "__main__":
    main()
