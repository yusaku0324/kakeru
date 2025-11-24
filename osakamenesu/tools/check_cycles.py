#!/usr/bin/env python3
"""Detect simple import cycles inside services/api/app.*"""

from __future__ import annotations

import argparse
import ast
from pathlib import Path
from typing import Dict, Iterable, List, Set


DEFAULT_ROOT = Path("services/api/app")
DEFAULT_PREFIX = "services.api.app"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Detect module import cycles")
    parser.add_argument("--root", type=Path, default=DEFAULT_ROOT)
    parser.add_argument("--prefix", type=str, default=DEFAULT_PREFIX)
    return parser.parse_args()


def module_name(path: Path, root: Path, prefix: str) -> str:
    rel = path.relative_to(root)
    parts = rel.with_suffix("").parts
    if not parts:
        return prefix
    return f"{prefix}.{'.'.join(parts)}"


def resolve_relative(module: str, level: int, current: str) -> str | None:
    current_parts = current.split(".")
    if level > len(current_parts):
        return None
    base_parts = current_parts[: len(current_parts) - level]
    if module:
        base_parts.extend(module.split("."))
    if not base_parts:
        return None
    return ".".join(base_parts)


def collect_imports(file_path: Path, module: str, prefix: str) -> Set[str]:
    code = file_path.read_text(encoding="utf-8")
    tree = ast.parse(code, filename=str(file_path))
    deps: Set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                name = alias.name
                if name.startswith(prefix):
                    deps.add(name)
        elif isinstance(node, ast.ImportFrom):
            target = node.module or ""
            if node.level:
                resolved = resolve_relative(target, node.level, module)
            else:
                resolved = target
            if not resolved:
                continue
            if resolved.startswith(prefix):
                deps.add(resolved)
    return deps


def build_graph(root: Path, prefix: str) -> Dict[str, Set[str]]:
    graph: Dict[str, Set[str]] = {}
    for file_path in root.rglob("*.py"):
        module = module_name(file_path, root, prefix)
        graph[module] = collect_imports(file_path, module, prefix)
    return graph


def find_cycles(graph: Dict[str, Set[str]]) -> List[List[str]]:
    visited: Set[str] = set()
    stack: List[str] = []
    on_stack: Set[str] = set()
    cycles: List[List[str]] = []

    def dfs(node: str) -> None:
        visited.add(node)
        stack.append(node)
        on_stack.add(node)
        for neighbor in graph.get(node, set()):
            if neighbor not in graph:
                continue
            if neighbor not in visited:
                dfs(neighbor)
            elif neighbor in on_stack:
                try:
                    idx = stack.index(neighbor)
                except ValueError:
                    continue
                cycle = stack[idx:] + [neighbor]
                cycles.append(cycle)
        stack.pop()
        on_stack.discard(node)

    for node in graph:
        if node not in visited:
            dfs(node)
    return cycles


def main() -> int:
    args = parse_args()
    root = args.root.resolve()
    if not root.exists():
        print(f"root {root} not found")
        return 1
    graph = build_graph(root, args.prefix)
    cycles = find_cycles(graph)
    if cycles:
        print("Detected import cycles:")
        for cycle in cycles:
            display = " -> ".join(cycle)
            print(f"  • {display}")
        return 1
    print("Cycle check passed (no import cycles within prefix).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
