#!/usr/bin/env python3
"""Lightweight architecture hygiene checks.

This script surfaces oversized modules and other refactor signals so the team can
spot hotspots early.  It intentionally keeps dependencies to the Python stdlib so
it can run in CI without extras.
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from fnmatch import fnmatch
from pathlib import Path
from typing import Iterable, Iterator
import re

try:  # Python 3.11+
    import tomllib
except ModuleNotFoundError:  # pragma: no cover - fallback for <3.11
    tomllib = None  # type: ignore[assignment]


REPO_ROOT = Path(__file__).resolve().parents[1]


@dataclass
class FileStat:
    path: Path
    relative_path: Path
    line_count: int
    extension: str


@dataclass
class LargeFileIssue:
    path: Path
    relative_path: Path
    line_count: int
    threshold: int


@dataclass
class AllowlistEntry:
    path: str
    max_lines: int | None = None
    reason: str | None = None


@dataclass
class ImportRuleAllowEntry:
    path: str
    reason: str | None = None


@dataclass
class ImportRule:
    name: str
    include: list[str]
    disallow: list[str]
    allow: dict[str, ImportRuleAllowEntry]


@dataclass
class ImportViolation:
    rule: ImportRule
    relative_path: Path
    line_no: int
    line: str
    module: str


@dataclass
class ImportAcknowledged:
    violation: ImportViolation
    allow_entry: ImportRuleAllowEntry


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Architecture hygiene checks")
    parser.add_argument("--root", type=Path, default=REPO_ROOT, help="project root")
    parser.add_argument(
        "--config",
        type=Path,
        default=None,
        help="Optional TOML config (defaults to tools/architecture_check.toml)",
    )
    parser.add_argument(
        "--max-lines",
        type=int,
        default=None,
        help="Override max lines threshold",
    )
    parser.add_argument(
        "--extensions",
        type=str,
        default=None,
        help="Comma separated list of extensions (.py,.ts,...)",
    )
    parser.add_argument(
        "--include",
        type=str,
        default=None,
        help="Comma separated paths to include (relative to repo root)",
    )
    parser.add_argument(
        "--exclude",
        type=str,
        default=None,
        help="Comma separated glob patterns to ignore",
    )
    parser.add_argument(
        "--hotspot-depth",
        type=int,
        default=None,
        help="Aggregate hotspots up to this path depth (default: 3)",
    )
    parser.add_argument(
        "--summary-limit",
        type=int,
        default=None,
        help="Limit number of items shown per section",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Emit JSON report (useful for CI annotations)",
    )
    parser.add_argument(
        "--fail-on-issues",
        action="store_true",
        help="Return non-zero exit code when issues are detected",
    )
    return parser.parse_args()


def default_config() -> dict:
    return {
        "max_lines": 600,
        "extensions": [".py", ".ts", ".tsx"],
        "include": ["services/api", "apps/web/src"],
        "exclude": [
            "**/.git/**",
            "**/.next/**",
            "**/.pnpm-store/**",
            "**/node_modules/**",
            "**/__pycache__/**",
            "**/.pytest_cache/**",
            "**/.venv/**",
        ],
        "hotspot_depth": 3,
        "summary_limit": 15,
        "allowlist": [],
        "import_rules": [],
    }


def load_config(path: Path | None) -> dict:
    cfg = default_config()
    if path is None:
        candidate = REPO_ROOT / "tools" / "architecture_check.toml"
        if candidate.exists():
            path = candidate
    if path is None or not path.exists():
        return cfg
    if tomllib is None:
        raise RuntimeError("tomllib is required to read the config file")
    data = tomllib.loads(path.read_text(encoding="utf-8"))
    cfg.update(data.get("defaults", {}))
    cfg["include"] = data.get("include", cfg.get("include"))
    cfg["exclude"] = data.get("exclude", cfg.get("exclude"))
    cfg["hotspot_depth"] = data.get("hotspot_depth", cfg.get("hotspot_depth"))
    if "summary_limit" in data:
        cfg["summary_limit"] = data["summary_limit"]
    cfg["allowlist"] = data.get("allowlist", [])
    cfg["import_rules"] = data.get("import_rules", [])
    return cfg


def normalize_list(raw: str | Iterable[str] | None) -> list[str]:
    if raw is None:
        return []
    if isinstance(raw, str):
        return [item.strip() for item in raw.split(",") if item.strip()]
    return list(raw)


def parse_import_rules(raw: Iterable[dict] | None) -> list[ImportRule]:
    rules: list[ImportRule] = []
    if not raw:
        return rules
    for entry in raw:
        if not isinstance(entry, dict):
            continue
        name = entry.get("name") or "rule"
        include = normalize_list(entry.get("include"))
        disallow = normalize_list(entry.get("disallow"))
        allow_entries: dict[str, ImportRuleAllowEntry] = {}
        for allow in entry.get("allow", []) or []:
            if not isinstance(allow, dict):
                continue
            path = allow.get("path")
            if not path:
                continue
            allow_entries[path] = ImportRuleAllowEntry(
                path=path,
                reason=allow.get("reason"),
            )
        if not include or not disallow:
            continue
        rules.append(ImportRule(name=name, include=include, disallow=disallow, allow=allow_entries))
    return rules


def iter_files(
    root: Path,
    include_paths: Iterable[str],
    excludes: Iterable[str],
    extensions: Iterable[str],
) -> Iterator[Path]:
    normalized_exts = {ext if ext.startswith(".") else f".{ext}" for ext in extensions}
    exclude_patterns = list(excludes)

    def is_excluded(path: Path) -> bool:
        posix = path.as_posix()
        return any(fnmatch(posix, pattern) for pattern in exclude_patterns)

    for include in include_paths:
        base = root / include
        if not base.exists():
            continue
        for candidate in base.rglob("*"):
            if candidate.is_dir():
                continue
            if candidate.suffix not in normalized_exts:
                continue
            if is_excluded(candidate):
                continue
            yield candidate


def count_lines(path: Path) -> int:
    try:
        with path.open("r", encoding="utf-8", errors="ignore") as fh:
            return sum(1 for _ in fh)
    except OSError:
        return 0


def gather_file_stats(file_paths: Iterable[Path], root: Path) -> list[FileStat]:
    stats: list[FileStat] = []
    for file_path in file_paths:
        rel = file_path.relative_to(root)
        stats.append(
            FileStat(
                path=file_path,
                relative_path=rel,
                line_count=count_lines(file_path),
                extension=file_path.suffix,
            )
        )
    return stats


def detect_large_files(stats: Iterable[FileStat], max_lines: int) -> list[LargeFileIssue]:
    issues: list[LargeFileIssue] = []
    for entry in stats:
        if entry.line_count >= max_lines:
            issues.append(
                LargeFileIssue(
                    path=entry.path,
                    relative_path=entry.relative_path,
                    line_count=entry.line_count,
                    threshold=max_lines,
                )
            )
    issues.sort(key=lambda issue: issue.line_count, reverse=True)
    return issues


def parse_allowlist(raw: Iterable[dict] | None) -> list[AllowlistEntry]:
    entries: list[AllowlistEntry] = []
    if not raw:
        return entries
    for row in raw:
        path = row.get("path") if isinstance(row, dict) else None
        if not path or not isinstance(path, str):
            continue
        max_lines = row.get("max_lines") if isinstance(row, dict) else None
        try:
            max_lines_int = int(max_lines) if max_lines is not None else None
        except (TypeError, ValueError):  # pragma: no cover - defensive
            max_lines_int = None
        reason = row.get("reason") if isinstance(row, dict) else None
        entries.append(AllowlistEntry(path=path, max_lines=max_lines_int, reason=reason))
    return entries


def apply_allowlist(
    issues: list[LargeFileIssue], entries: list[AllowlistEntry]
) -> tuple[list[LargeFileIssue], list[tuple[LargeFileIssue, AllowlistEntry]]]:
    if not entries:
        return issues, []
    remaining: list[LargeFileIssue] = []
    acknowledged: list[tuple[LargeFileIssue, AllowlistEntry]] = []
    index = {entry.path: entry for entry in entries}
    for issue in issues:
        rel_posix = issue.relative_path.as_posix()
        match = index.get(rel_posix)
        if match and (match.max_lines is None or issue.line_count <= match.max_lines):
            acknowledged.append((issue, match))
        else:
            remaining.append(issue)
    return remaining, acknowledged


def build_hotspots(stats: Iterable[FileStat], depth: int) -> list[tuple[str, int]]:
    totals: dict[str, int] = {}
    for entry in stats:
        parts = entry.relative_path.parts
        if not parts:
            key = str(entry.relative_path)
        else:
            slice_end = depth if depth > 0 else len(parts)
            key = "/".join(parts[:slice_end]) if slice_end <= len(parts) else "/".join(parts)
        totals[key] = totals.get(key, 0) + entry.line_count
    return sorted(totals.items(), key=lambda item: item[1], reverse=True)


_pattern_cache: dict[str, re.Pattern[str]] = {}


def _compile_pattern(pattern: str) -> re.Pattern[str]:
    cached = _pattern_cache.get(pattern)
    if cached:
        return cached
    regex_parts: list[str] = ["^"]
    i = 0
    while i < len(pattern):
        ch = pattern[i]
        if ch == "*":
            if i + 1 < len(pattern) and pattern[i + 1] == "*":
                regex_parts.append(".*")
                i += 2
                continue
            regex_parts.append(".*")
        elif ch == "?":
            regex_parts.append(".")
        else:
            regex_parts.append(re.escape(ch))
        i += 1
    regex_parts.append("$")
    compiled = re.compile("".join(regex_parts))
    _pattern_cache[pattern] = compiled
    return compiled


def _match_patterns(path: Path, patterns: Iterable[str]) -> bool:
    posix = path.as_posix()
    return any(_compile_pattern(pattern).match(posix) for pattern in patterns)


def _find_disallowed_imports(path: Path, modules: list[str]) -> list[tuple[int, str, str]]:
    if not modules:
        return []
    matches: list[tuple[int, str, str]] = []
    patterns = [
        re.compile(rf"^\s*from\s+{re.escape(module)}(?:\.|\s)") for module in modules
    ] + [
        re.compile(rf"^\s*import\s+{re.escape(module)}(?:\.|\s|$)") for module in modules
    ]
    try:
        with path.open("r", encoding="utf-8", errors="ignore") as fh:
            for idx, line in enumerate(fh, start=1):
                for module, regex in zip(modules * 2, patterns):
                    if regex.search(line):
                        matches.append((idx, line.rstrip(), module))
                        break
    except OSError:
        return []
    return matches


def evaluate_import_rules(
    stats: Iterable[FileStat],
    rules: list[ImportRule],
) -> tuple[list[ImportViolation], list[ImportAcknowledged]]:
    violations: list[ImportViolation] = []
    acknowledged: list[ImportAcknowledged] = []
    if not rules:
        return violations, acknowledged
    for entry in stats:
        rel_posix = entry.relative_path.as_posix()
        for rule in rules:
            if not _match_patterns(entry.relative_path, rule.include):
                continue
            matches = _find_disallowed_imports(entry.path, rule.disallow)
            for line_no, line, module in matches:
                violation = ImportViolation(
                    rule=rule,
                    relative_path=entry.relative_path,
                    line_no=line_no,
                    line=line,
                    module=module,
                )
                allow_entry = rule.allow.get(rel_posix)
                if allow_entry:
                    acknowledged.append(ImportAcknowledged(violation=violation, allow_entry=allow_entry))
                else:
                    violations.append(violation)
    return violations, acknowledged


def to_jsonable(
    stats: list[FileStat],
    issues: list[LargeFileIssue],
    hotspots: list[tuple[str, int]],
    acknowledged: list[tuple[LargeFileIssue, AllowlistEntry]],
    import_violations: list[ImportViolation],
    import_acknowledged: list[ImportAcknowledged],
) -> dict:
    return {
        "files_scanned": len(stats),
        "issues": [
            {
                "path": str(issue.relative_path),
                "line_count": issue.line_count,
                "threshold": issue.threshold,
            }
            for issue in issues
        ],
        "allowlisted": [
            {
                "path": str(item.relative_path),
                "line_count": item.line_count,
                "threshold": item.threshold,
                "allow": {
                    "path": entry.path,
                    "max_lines": entry.max_lines,
                    "reason": entry.reason,
                },
            }
            for item, entry in acknowledged
        ],
        "import_violations": [
            {
                "path": str(item.relative_path),
                "line": item.line.strip(),
                "line_no": item.line_no,
                "module": item.module,
                "rule": item.rule.name,
            }
            for item in import_violations
        ],
        "import_allowlisted": [
            {
                "path": str(item.violation.relative_path),
                "line": item.violation.line.strip(),
                "line_no": item.violation.line_no,
                "module": item.violation.module,
                "rule": item.violation.rule.name,
                "allow": {
                    "path": item.allow_entry.path,
                    "reason": item.allow_entry.reason,
                },
            }
            for item in import_acknowledged
        ],
        "hotspots": [
            {"path": path, "line_count": line_count}
            for path, line_count in hotspots
        ],
    }


def print_summary(
    stats: list[FileStat],
    issues: list[LargeFileIssue],
    hotspots: list[tuple[str, int]],
    summary_limit: int,
    acknowledged: list[tuple[LargeFileIssue, AllowlistEntry]],
    import_violations: list[ImportViolation],
    import_acknowledged: list[ImportAcknowledged],
) -> None:
    if not stats:
        print("No files scanned.")
        return

    print(f"Scanned {len(stats)} files. Top oversized modules:")
    if not issues:
        print("  ✅ No files exceeded the configured threshold.")
    else:
        for issue in issues[:summary_limit]:
            print(
                f"  • {issue.relative_path} — {issue.line_count} lines (threshold {issue.threshold})"
            )
        if len(issues) > summary_limit:
            print(f"  … {len(issues) - summary_limit} more")

    if acknowledged:
        print("\nAllowlisted (known debt):")
        for issue, entry in acknowledged[:summary_limit]:
            reason = f" ({entry.reason})" if entry.reason else ""
            allowance = (
                f"<= {entry.max_lines} lines" if entry.max_lines is not None else "no limit"
            )
            print(
                f"  • {issue.relative_path} — {issue.line_count} lines allowed {allowance}{reason}"
            )
        if len(acknowledged) > summary_limit:
            print(f"  … {len(acknowledged) - summary_limit} more")

    print("\nHotspot directories:")
    for path, line_count in hotspots[:summary_limit]:
        print(f"  • {path or '.'} — {line_count} lines")

    if import_violations or import_acknowledged:
        print("\nDependency guard (imports):")
        if import_violations:
            for violation in import_violations[:summary_limit]:
                print(
                    f"  • {violation.relative_path}:{violation.line_no} imports {violation.module} (rule: {violation.rule.name})"
                )
            if len(import_violations) > summary_limit:
                print(f"  … {len(import_violations) - summary_limit} more")
        else:
            print("  ✅ No new import violations")

        if import_acknowledged:
            print("\n  Allowlisted imports:")
            for item in import_acknowledged[:summary_limit]:
                reason = f" ({item.allow_entry.reason})" if item.allow_entry.reason else ""
                print(
                    f"    • {item.violation.relative_path}:{item.violation.line_no} imports {item.violation.module} [rule: {item.violation.rule.name}]{reason}"
                )
            if len(import_acknowledged) > summary_limit:
                print(f"    … {len(import_acknowledged) - summary_limit} more")


def main() -> int:
    args = parse_args()
    cfg = load_config(args.config)

    max_lines = args.max_lines or int(cfg.get("max_lines", 600))
    extensions = (
        normalize_list(args.extensions) or cfg.get("extensions", [".py", ".ts", ".tsx"])
    )
    include = normalize_list(args.include) or cfg.get("include", [])
    exclude = normalize_list(args.exclude) or cfg.get("exclude", [])
    allowlist_cfg = cfg.get("allowlist", [])
    import_rules_cfg = cfg.get("import_rules", [])
    hotspot_depth = args.hotspot_depth or int(cfg.get("hotspot_depth", 3))
    summary_limit = args.summary_limit or int(cfg.get("summary_limit", 15))

    file_paths = list(iter_files(args.root, include, exclude, extensions))
    stats = gather_file_stats(file_paths, args.root)
    large_files = detect_large_files(stats, max_lines)
    allowlist_entries = parse_allowlist(allowlist_cfg)
    remaining_issues, acknowledged = apply_allowlist(large_files, allowlist_entries)
    import_rules = parse_import_rules(import_rules_cfg)
    import_violations, import_ack = evaluate_import_rules(stats, import_rules)
    hotspots = build_hotspots(stats, hotspot_depth)

    if args.json:
        json.dump(
            to_jsonable(stats, remaining_issues, hotspots, acknowledged, import_violations, import_ack),
            sys.stdout,
            indent=2,
        )
        sys.stdout.write("\n")
    else:
        print_summary(
            stats,
            remaining_issues,
            hotspots,
            summary_limit,
            acknowledged,
            import_violations,
            import_ack,
        )

    if args.fail_on_issues and (remaining_issues or import_violations):
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
