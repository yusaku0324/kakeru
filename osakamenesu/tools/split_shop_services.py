"""Utility to extract sections from shop_services.py into new modules."""

from __future__ import annotations

import argparse
import ast
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, List, Sequence

ROOT = Path(__file__).resolve().parents[1] / "services/api/app/domains/site/services"
SHOP_SERVICES_PATH = ROOT / "shop_services.py"


@dataclass
class NodeInfo:
    name: str
    start: int
    end: int


def _discover_nodes(path: Path) -> list[NodeInfo]:
    source = path.read_text()
    module = ast.parse(source)
    nodes: list[NodeInfo] = []
    for node in module.body:
        name: str | None = None
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            name = node.name
        elif isinstance(node, ast.Assign):
            targets = [t for t in node.targets if isinstance(t, ast.Name)]
            if len(targets) == 1:
                name = targets[0].id
        elif isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name):
            name = node.target.id
        if not name:
            continue
        nodes.append(NodeInfo(name=name, start=node.lineno, end=node.end_lineno or node.lineno))
    return nodes


def _collect_snippets(source_lines: Sequence[str], targets: Iterable[NodeInfo]) -> str:
    chunks: list[str] = []
    for info in targets:
        chunk = source_lines[info.start - 1 : info.end]
        chunks.append("\n".join(chunk).rstrip() + "\n\n")
    return "".join(chunks)


def main() -> None:
    parser = argparse.ArgumentParser(description="Split sections from shop_services.py")
    parser.add_argument("--names", required=True, help="Comma separated definitions to extract")
    parser.add_argument("--output", required=True, help="File path to write the extracted code")
    parser.add_argument("--source", default=str(SHOP_SERVICES_PATH), help="Source file path")
    parser.add_argument("--prepend", help="Optional file whose contents are written before the snippet")
    parser.add_argument("--remove", action="store_true", help="Remove extracted code from the source file")
    parser.add_argument("--dry-run", action="store_true", help="Print actions without writing files")
    args = parser.parse_args()

    source_path = Path(args.source)
    source_lines = source_path.read_text().splitlines()
    nodes = _discover_nodes(source_path)
    name_map = {n.name: n for n in nodes}

    requested = [name.strip() for name in args.names.split(",") if name.strip()]
    missing = [name for name in requested if name not in name_map]
    if missing:
        raise SystemExit(f"Definitions not found: {', '.join(missing)}")

    selected = sorted((name_map[name] for name in requested), key=lambda n: n.start)
    snippet = _collect_snippets(source_lines, selected)

    header = ""
    if args.prepend:
        header = Path(args.prepend).read_text()
        if not header.endswith("\n\n"):
            header = header.rstrip() + "\n\n"

    if args.dry_run:
        print(f"Would write {len(selected)} definitions to {args.output}")
    else:
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with output_path.open("w", encoding="utf-8") as fh:
            if header:
                fh.write(header)
            fh.write(snippet.rstrip() + "\n")
        print(f"Wrote {len(selected)} definitions to {output_path}")

    if args.remove and not args.dry_run:
        edited = source_lines[:]
        for info in reversed(selected):
            for idx in range(info.start - 1, info.end):
                edited[idx] = None  # type: ignore[index]
        filtered = [line for line in edited if line is not None]
        source_path.write_text("\n".join(filtered) + "\n")
        print(f"Removed definitions from {source_path}")


if __name__ == "__main__":
    main()
