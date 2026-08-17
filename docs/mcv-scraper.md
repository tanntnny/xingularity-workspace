# MyCourseVille assignment sync

`scripts/mcv-scraper.py` logs into the MyCourseVille assignments page, reads
assignment rows, and prints Xingularity schedule actions. Each assignment uses
the stable key `mcv:assignment:<remote-id>`, the `mcv` tag, and
`taskType: "assignment"`. A completed/submitted assignment is emitted as a
completed task update.

## Standalone use

Install Playwright and its Chromium browser once:

```bash
python3 -m pip install playwright
python3 -m playwright install chromium
```

Set credentials for a one-off run rather than committing them:

```bash
MCV_USERNAME='your-username' MCV_PASSWORD='your-password' \
  python3 scripts/mcv-scraper.py > mcv-actions.json
```

The first run stores the browser session under `~/.mcv-scraper-profile`. Use
`--headed` to see the browser during login, and `--debug` to save page HTML and
a screenshot there when selectors need investigation. Diagnostics go to
stderr; stdout contains one JSON object with an `actions` array.

## Use from the Scheduling page

1. Create a Python automation and paste the contents of
   `scripts/mcv-scraper.py` into the code editor.
2. Set the trigger to the desired interval or daily time.
3. Enable `Network access`, `Create tasks`, `Update tasks`, and `Use secrets`.
4. Save secrets named `MCV_USERNAME` and `MCV_PASSWORD`, then add those names
   to `Secret refs`.
5. Start with `Review before apply`; switch to `Auto apply` after checking a
   run’s proposed actions.

The scheduler exposes configured secrets to Python only as
`XINGULARITY_SECRET_<NAME>` environment variables. The script understands
those names as well as `MCV_USERNAME` and `MCV_PASSWORD`, so credentials do not
need to be written into the pasted code. The scheduler masks secret values in
captured stdout and stderr.

## Reconciliation behavior

The script emits both `task.create` and `task.update` for every assignment.
Creates are idempotent by `automationSource` plus `automationSourceKey`, and
updates refresh title, description, due date when present, the `mcv` tag, and
completion status. A missing due date is intentionally not sent on update, so
an existing local date is not cleared by an incomplete scrape.

The scraper filters rows that look archived or inactive unless
`--include-archived` is used. Because MyCourseVille markup or login flows can
change, run with `--headed --debug` and inspect the saved HTML before changing
selectors. Do not commit credentials, browser profiles, action output, or
debug captures.
