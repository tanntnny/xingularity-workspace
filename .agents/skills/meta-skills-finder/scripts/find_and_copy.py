#!/usr/bin/env python3
"""Search the skill catalog and copy selected skill bundles into a project."""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import sys
from pathlib import Path


NAME_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def database_default() -> Path:
    configured = os.environ.get("SKILL_DATABASE")
    return Path(configured).expanduser() if configured else Path.home() / ".xcodex" / "skills"


def load_catalog(database: Path) -> list[dict[str, str]]:
    catalog_file = database / "catalog.json"
    if not catalog_file.is_file():
        raise FileNotFoundError(f"catalog not found: {catalog_file}; rebuild it first")
    payload = json.loads(catalog_file.read_text(encoding="utf-8"))
    skills = payload.get("skills")
    if not isinstance(skills, list):
        raise ValueError("catalog has no valid skills list")
    return skills


def search(skills: list[dict[str, str]], query: str) -> list[tuple[int, dict[str, str]]]:
    terms = [term.lower() for term in re.findall(r"[a-z0-9]+", query.lower())]
    if not terms:
        return []

    matches = []
    for skill in skills:
        name = str(skill.get("name", ""))
        description = str(skill.get("description", ""))
        haystack = f"{name} {description}".lower()
        score = sum((3 if term in name.lower() else 1) for term in terms if term in haystack)
        if score:
            matches.append((score, skill))
    return sorted(matches, key=lambda item: (-item[0], item[1].get("name", "")))


def safe_source(database: Path, relative_path: str) -> Path:
    source = (database / relative_path).resolve()
    try:
        source.relative_to(database)
    except ValueError as error:
        raise ValueError(f"catalog path escapes database: {relative_path}") from error
    if not source.is_dir() or not (source / "SKILL.md").is_file():
        raise FileNotFoundError(f"skill bundle is missing: {source}")
    return source


def copy_skills(
    skills: list[dict[str, str]],
    names: list[str],
    database: Path,
    project_root: Path,
    overwrite: bool,
) -> int:
    by_name = {skill.get("name"): skill for skill in skills}
    destination_root = (project_root / ".agents" / "skills").resolve()
    copied = 0

    for name in names:
        if not NAME_PATTERN.fullmatch(name):
            print(f"error: invalid skill name: {name}", file=sys.stderr)
            continue
        entry = by_name.get(name)
        if entry is None:
            print(f"error: skill is not in catalog: {name}", file=sys.stderr)
            continue
        source = safe_source(database, str(entry.get("path", "")))
        target = destination_root / name
        if source == target:
            print(f"already at destination: {name}")
            continue
        if target.exists() and not overwrite:
            print(f"skipped existing skill: {target} (use --overwrite to refresh)")
            continue
        destination_root.mkdir(parents=True, exist_ok=True)
        shutil.copytree(source, target, dirs_exist_ok=True)
        print(f"copied {name} -> {target}")
        copied += 1
    return copied


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--query", help="search names and descriptions without loading skill bodies")
    mode.add_argument("--copy", nargs="+", metavar="SKILL", help="copy exact catalog names")
    parser.add_argument("--database", type=Path, default=database_default())
    parser.add_argument("--project-root", type=Path, default=Path.cwd())
    parser.add_argument("--limit", type=int, default=10)
    parser.add_argument("--overwrite", action="store_true")
    args = parser.parse_args()

    database = args.database.expanduser().resolve()
    try:
        skills = load_catalog(database)
        if args.query is not None:
            matches = search(skills, args.query)[: max(args.limit, 0)]
            if not matches:
                print("no matching skills")
                return 0
            for score, skill in matches:
                print(f"{skill['name']}\t{score}\t{skill['description']}")
            return 0
        copy_skills(skills, args.copy, database, args.project_root.expanduser().resolve(), args.overwrite)
        return 0
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
