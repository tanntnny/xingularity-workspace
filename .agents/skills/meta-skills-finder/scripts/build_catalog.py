#!/usr/bin/env python3
"""Build a metadata-only catalog for the central skill database."""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path

try:
    import yaml
except ImportError:  # pragma: no cover - the Codex environment normally provides PyYAML.
    yaml = None


NAME_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
FRONTMATTER_PATTERN = re.compile(r"^---\n(.*?)\n---(?:\n|$)", re.DOTALL)


def database_default() -> Path:
    configured = os.environ.get("SKILL_DATABASE")
    return Path(configured).expanduser() if configured else Path.home() / ".xcodex" / "skills"


def read_metadata(skill_file: Path) -> dict[str, str]:
    match = FRONTMATTER_PATTERN.match(skill_file.read_text(encoding="utf-8"))
    if not match:
        raise ValueError("missing YAML frontmatter")

    if yaml is None:
        values: dict[str, str] = {}
        for line in match.group(1).splitlines():
            key, separator, value = line.partition(":")
            if separator and key.strip() in {"name", "description"}:
                values[key.strip()] = value.strip().strip("'\"")
        metadata = values
    else:
        metadata = yaml.safe_load(match.group(1)) or {}

    name = metadata.get("name")
    description = metadata.get("description")
    if not isinstance(name, str) or not NAME_PATTERN.fullmatch(name.strip()):
        raise ValueError("frontmatter name must be lowercase hyphen-case")
    if not isinstance(description, str) or not description.strip():
        raise ValueError("frontmatter description is required")
    return {"name": name.strip(), "description": " ".join(description.split())}


def build_catalog(database: Path) -> dict:
    if not database.is_dir():
        raise FileNotFoundError(f"skill database does not exist: {database}")

    skills = []
    for skill_dir in sorted(database.iterdir(), key=lambda path: path.name):
        if not skill_dir.is_dir() or skill_dir.name.startswith("."):
            continue
        skill_file = skill_dir / "SKILL.md"
        if not skill_file.is_file():
            continue
        try:
            metadata = read_metadata(skill_file)
        except (OSError, ValueError) as error:
            print(f"warning: skipping {skill_dir}: {error}", file=sys.stderr)
            continue
        metadata["path"] = skill_dir.name
        skills.append(metadata)

    return {"schema_version": 1, "skills": skills}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database", type=Path, default=database_default())
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    database = args.database.expanduser().resolve()
    output = (args.output or database / "catalog.json").expanduser().resolve()
    try:
        catalog = build_catalog(database)
    except (FileNotFoundError, OSError) as error:
        parser.error(str(error))

    output.write_text(json.dumps(catalog, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"catalogued {len(catalog['skills'])} skills in {output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
