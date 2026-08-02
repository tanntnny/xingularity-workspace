# Meta Skills Finder

## Overview

Use the metadata-only catalog in `~/.xcodex/skills/catalog.json` to discover candidate skills, then copy selected bundles into the current project's `.agents/skills/` directory. Keep the central database out of the project context; load a copied skill's `SKILL.md` only after selecting it.

## Workflow

1. Identify the project's root and the task's concrete domains. Treat the current working directory as the project root unless the user specifies another root.

2. Search names and descriptions without opening every skill body:

   ```bash
   python3 ~/.xcodex/shared/skills/meta-skills-finder/scripts/find_and_copy.py \
     --query "<task domains>" --project-root <project-root>
   ```

3. Select only the candidates that materially apply. Inspect their full `SKILL.md` files after selection, not during the broad search.

4. Copy selected bundles by exact catalog name:

   ```bash
   python3 ~/.xcodex/shared/skills/meta-skills-finder/scripts/find_and_copy.py \
     --copy <skill-name> [<another-skill-name>] --project-root <project-root>
   ```

   The command creates `<project-root>/.agents/skills/` when needed and skips an existing bundle unless `--overwrite` is explicitly requested.

## Maintaining the Catalog

When adding or updating a bundle in the central database, rebuild its metadata catalog:

```bash
python3 ~/.xcodex/shared/skills/meta-skills-finder/scripts/build_catalog.py
```

The catalog contains only `name`, `description`, and relative bundle paths. Never put full skill bodies into it.
