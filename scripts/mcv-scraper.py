#!/usr/bin/env python3
"""Scrape MyCourseVille assignments and emit Xingularity schedule actions.

Install prerequisites once:
    python3 -m pip install playwright
    python3 -m playwright install chromium

The script prints exactly one JSON action envelope to stdout. Diagnostics go to
stderr so the output can be pasted into or piped through the scheduler safely.
"""

from __future__ import annotations

import argparse
import getpass
import json
import os
import re
import sys
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Iterable
from urllib.parse import parse_qs, urljoin, urlparse

MCV_ASSIGNMENTS_URL = "https://alpha.mycourseville.com/assignments"
MCV_USERNAME = "REPLACE_WITH_USERNAME"
MCV_PASSWORD = "REPLACE_WITH_PASSWORD"
PROFILE_DIRECTORY = Path.home() / ".mcv-scraper-profile"

ASSIGNMENT_ID_PATTERN = re.compile(
    r"(?:assignment|assignments)[^a-zA-Z0-9]+([a-zA-Z0-9_-]+)", re.IGNORECASE
)
ISO_DATE_PATTERN = re.compile(r"\b(20\d{2}-\d{1,2}-\d{1,2})\b")
SLASH_DATE_PATTERN = re.compile(r"\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2})\b")
TEXT_DATE_PATTERN = re.compile(r"\b(\d{1,2})\s+([A-Za-z]{3,9})\s+(20\d{2})\b")
TIME_PATTERN = re.compile(
    r"(?<!\d)(?P<hour>\d{1,2})[:.](?P<minute>\d{2})"
    r"\s*(?P<meridiem>a\.?m\.?|p\.?m\.?|น\.)?(?!\d)",
    re.IGNORECASE,
)
LOGIN_PATTERN = re.compile(r"login|log in|sign in|เข้าสู่ระบบ", re.IGNORECASE)
COMPLETED_PATTERN = re.compile(
    r"\b(?:completed|submitted|done)\b|เสร็จ|ส่งแล้ว|ส่งงานแล้ว", re.IGNORECASE
)
NOT_COMPLETED_PATTERN = re.compile(
    r"\b(?:incomplete|pending|not\s+(?:completed|submitted))\b|ยังไม่เสร็จ|ยังไม่ส่ง",
    re.IGNORECASE,
)

LOGIN_PLATFORM_SELECTORS = (
    'button:has-text("Login with myCourseVille Platform")',
    'a:has-text("Login with myCourseVille Platform")',
    'button:has-text("Log in with platform")',
    'a:has-text("Log in with platform")',
    'button:has-text("เข้าสู่ระบบ")',
    'a:has-text("เข้าสู่ระบบ")',
)
LOGIN_PLATFORM_NAMES = (
    "Login with myCourseVille Platform",
    "Log in with platform",
)
LOGIN_USERNAME_SELECTORS = (
    'input#username',
    'input[name="username"]',
    'input[name="name"]',
    'input[name="user"]',
    'input[name*="user"]',
    'input[type="username"]',
    'input[type="email"]',
    'input[autocomplete="username"]',
    'input[placeholder*="Username" i]',
    'input[placeholder*="Email" i]',
)
LOGIN_PASSWORD_SELECTORS = (
    'input#password',
    'input[name="password"]',
    'input[name*="pass"]',
    'input[type="password"]',
    'input[autocomplete="current-password"]',
)
INACTIVE_PATTERN = re.compile(r"archived|inactive|past course|หมดอายุ", re.IGNORECASE)


@dataclass(frozen=True)
class Assignment:
    remote_id: str
    title: str
    course: str
    url: str
    due_date: str | None
    end_time: str | None
    completed: bool


def log(message: str) -> None:
    print(f"[mcv] {message}", file=sys.stderr)


def get_credentials() -> tuple[str, str]:
    username = get_configured_value("MCV_USERNAME", MCV_USERNAME).strip()
    password = get_configured_value("MCV_PASSWORD", MCV_PASSWORD)

    if username == "REPLACE_WITH_USERNAME":
        print("MCV username: ", end="", file=sys.stderr, flush=True)
        username = sys.stdin.readline().strip()
    if password == "REPLACE_WITH_PASSWORD":
        password = getpass.getpass("MCV password: ")

    if not username or not password:
        raise RuntimeError("MCV username and password are required")
    return username, password


def get_configured_value(name: str, fallback: str) -> str:
    """Read standalone env vars or the scheduler's prefixed secret env vars."""
    return os.environ.get(name) or os.environ.get(
        f"XINGULARITY_SECRET_{name.upper()}", fallback
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--headed",
        action="store_true",
        help="show Chromium while logging in or diagnosing selectors",
    )
    parser.add_argument(
        "--include-archived",
        action="store_true",
        help="include assignments from rows that look archived or inactive",
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        help="save the current page HTML and screenshot in the browser profile",
    )
    return parser.parse_args()


def first_visible(page, selectors: Iterable[str]):
    for selector in selectors:
        locator = page.locator(selector).first
        try:
            if locator.count() > 0 and locator.is_visible():
                return locator
        except Exception:
            continue
    return None


def click_login_platform(page) -> None:
    locator = login_platform_locator(page)
    if locator is not None:
        locator.click()
        try:
            page.wait_for_load_state("domcontentloaded", timeout=15_000)
        except Exception:
            # The SSO page can continue loading while its login form is already
            # usable. The form wait in ensure_authenticated is authoritative.
            pass


def fill_login_form(page, username: str, password: str) -> None:
    username_input = first_visible(
        page,
        LOGIN_USERNAME_SELECTORS,
    )
    password_input = first_visible(
        page,
        LOGIN_PASSWORD_SELECTORS,
    )
    if username_input is None or password_input is None:
        raise RuntimeError("Could not find the MCV username/password form")

    username_input.fill(username)
    password_input.fill(password)

    submit = first_visible(
        page,
        (
            '#cv-login-cvecologinbutton',
            'button[type="submit"]',
            'input[type="submit"]',
            'button:has-text("Login")',
            'button:has-text("Sign in")',
            'button:has-text("เข้าสู่ระบบ")',
        ),
    )
    if submit is None:
        raise RuntimeError("Could not find the MCV login submit button")
    submit.click()
    page.wait_for_load_state("domcontentloaded", timeout=20_000)


def ensure_authenticated(page, context, username: str, password: str) -> None:
    page.goto(MCV_ASSIGNMENTS_URL, wait_until="domcontentloaded", timeout=30_000)

    if is_login_page(page):
        click_login_platform(page)
        try:
            page.wait_for_selector(
                ", ".join((*LOGIN_USERNAME_SELECTORS, *LOGIN_PASSWORD_SELECTORS)),
                state="visible",
                timeout=15_000,
            )
        except Exception as error:
            raise RuntimeError(
                "MCV login form did not appear after selecting platform login"
            ) from error
        fill_login_form(page, username, password)

    page.goto(MCV_ASSIGNMENTS_URL, wait_until="domcontentloaded", timeout=30_000)
    page.wait_for_timeout(1_500)

    if is_login_page(page):
        raise RuntimeError(
            "MCV authentication did not complete; set MCV_USERNAME/MCV_PASSWORD "
            "or scheduler secrets, then retry with --headed --debug"
        )

    # Retain the profile so a later run can reuse a valid session cookie.
    context.storage_state(path=str(PROFILE_DIRECTORY / "storage-state.json"))


def is_login_page(page) -> bool:
    if login_platform_locator(page) is not None or first_visible(page, LOGIN_PASSWORD_SELECTORS) is not None:
        return True

    title = page.title()
    url = page.url() if callable(page.url) else page.url
    return LOGIN_PATTERN.search(title) is not None or "/api/login" in url


def login_platform_locator(page):
    for name in LOGIN_PLATFORM_NAMES:
        try:
            locator = page.get_by_role("button", name=name, exact=True)
            if locator.count() > 0 and locator.is_visible():
                return locator
        except Exception:
            continue

    return first_visible(page, LOGIN_PLATFORM_SELECTORS)


def extract_remote_id(href: str, assignment_id: str | None = None) -> str | None:
    if assignment_id and assignment_id.strip():
        return assignment_id.strip()

    parsed = urlparse(href)
    query_values = parse_qs(parsed.query)
    for key in ("assignment_id", "assignmentId", "id"):
        if query_values.get(key):
            return query_values[key][0]

    match = ASSIGNMENT_ID_PATTERN.search(parsed.path)
    return match.group(1) if match else None


def parse_due_date(text: str) -> str | None:
    candidates: list[tuple[int, date]] = []

    for match in ISO_DATE_PATTERN.finditer(text):
        try:
            candidates.append((match.start(), date.fromisoformat(match.group(1))))
        except ValueError:
            continue

    for match in SLASH_DATE_PATTERN.finditer(text):
        first, second, year = map(int, match.groups())
        for month, day in ((first, second), (second, first)):
            try:
                candidates.append((match.start(), date(year, month, day)))
                break
            except ValueError:
                continue

    for match in TEXT_DATE_PATTERN.finditer(text):
        day, month_name, year = match.groups()
        for format_name in ("%d %b %Y", "%d %B %Y"):
            try:
                parsed = datetime.strptime(
                    f"{day} {month_name} {year}",
                    format_name,
                ).date()
                candidates.append((match.start(), parsed))
                break
            except ValueError:
                continue

    return max(candidates, key=lambda candidate: candidate[0])[1].isoformat() if candidates else None


def parse_due_time(text: str) -> str | None:
    """Extract the last visible clock time and normalize it to HH:mm."""
    candidates: list[tuple[int, str]] = []

    for match in TIME_PATTERN.finditer(text):
        hour = int(match.group("hour"))
        minute = int(match.group("minute"))
        meridiem = (match.group("meridiem") or "").lower().replace(".", "")

        if minute > 59:
            continue

        if meridiem in {"am", "pm"}:
            if hour < 1 or hour > 12:
                continue
            if meridiem == "am":
                hour = 0 if hour == 12 else hour
            else:
                hour = 12 if hour == 12 else hour + 12
        elif hour > 23:
            continue

        candidates.append((match.start(), f"{hour:02d}:{minute:02d}"))

    return max(candidates, key=lambda candidate: candidate[0])[1] if candidates else None


def text_from(locator) -> str:
    try:
        return " ".join(locator.inner_text(timeout=1_000).split())
    except Exception:
        return ""


def row_title(row, fallback: str) -> str:
    title_locator = first_visible(
        row,
        (
            '[data-assignment-title]',
            '[class*="assignment-title" i]',
            'h1',
            'h2',
            'h3',
            'h4',
            'a[href*="assignment" i]',
        ),
    )
    title = text_from(title_locator) if title_locator is not None else ""
    return title or fallback or "Untitled MCV assignment"


def row_course(row) -> str:
    course_locator = first_visible(
        row,
        (
            '[data-course-name]',
            '[class*="course-name" i]',
            '[class*="course-title" i]',
        ),
    )
    return text_from(course_locator) if course_locator is not None else "MCV"


def row_is_completed(row, text: str) -> bool:
    try:
        completed_marker = row.locator(
            '[data-status="completed"], [aria-label*="completed" i], [class*="completed" i]'
        ).first
        if completed_marker.count() > 0:
            marker_text = text_from(completed_marker)
            marker_class = completed_marker.get_attribute("class") or ""
            marker_content = f"{marker_text} {marker_class}"
            if not NOT_COMPLETED_PATTERN.search(marker_content):
                return True
    except Exception:
        pass
    return bool(COMPLETED_PATTERN.search(text)) and not NOT_COMPLETED_PATTERN.search(text)


def assignment_rows(page):
    rows = page.locator(
        '[data-assignment-id], [data-assignment], [data-testid*="assignment" i], '
        '[id*="assignment" i], [class*="assignment" i], article, tr, li'
    ).all()
    if rows:
        return rows

    links = page.locator('a[href*="assignment" i]').all()
    assignment_cards = []
    for link in links:
        card = link.locator(
            'xpath=ancestor::div[contains(concat(" ", normalize-space(@class), " "), " bg-light ")][1]'
        ).first
        try:
            if card.count() > 0:
                assignment_cards.append(card)
                continue
        except Exception:
            pass
        assignment_cards.append(link.locator("xpath=..").first)
    return assignment_cards


def scrape_assignments(page, include_archived: bool) -> list[Assignment]:
    rows = assignment_rows(page)
    if not rows:
        raise RuntimeError("No assignment rows were found on the MCV page")

    assignments: list[Assignment] = []
    seen_ids: set[str] = set()
    for row in rows:
        text = text_from(row)
        if not text:
            continue
        if not include_archived and INACTIVE_PATTERN.search(text):
            continue

        link = first_visible(row, ('a[href*="assignment" i]', 'a[href]'))
        href = ""
        if link is not None:
            try:
                href = urljoin(MCV_ASSIGNMENTS_URL, link.get_attribute("href") or "")
            except Exception:
                href = ""

        assignment_id = None
        try:
            assignment_id = row.get_attribute("data-assignment-id")
        except Exception:
            pass
        remote_id = extract_remote_id(href, assignment_id)
        if not remote_id or remote_id in seen_ids:
            continue

        title = row_title(row, text.split("\n", 1)[0])
        course = row_course(row)
        assignments.append(
            Assignment(
                remote_id=remote_id,
                title=title,
                course=course,
                url=href or MCV_ASSIGNMENTS_URL,
                due_date=parse_due_date(text),
                end_time=parse_due_time(text),
                completed=row_is_completed(row, text),
            )
        )
        seen_ids.add(remote_id)

    if not assignments:
        raise RuntimeError(
            "The MCV page loaded but no assignment IDs were recognized; run with --debug"
        )
    return assignments


def action_for(assignment: Assignment) -> tuple[dict, dict]:
    title = f"{assignment.course}: {assignment.title}" if assignment.course else assignment.title
    description = f"Course: {assignment.course}\nMCV: {assignment.url}"
    status = "completed" if assignment.completed else "pending"
    source_key = f"assignment:{assignment.remote_id}"

    create = {
        "type": "task.create",
        "title": title[:200],
        "description": description[:2_000],
        "tags": ["mcv"],
        "date": assignment.due_date,
        "endTime": assignment.end_time,
        "priority": "medium",
        "taskType": "assignment",
        "status": status,
        "automationSource": "mcv",
        "automationSourceKey": source_key,
    }
    create = {key: value for key, value in create.items() if value is not None}

    update = {
        "type": "task.update",
        "title": title[:200],
        "description": description[:2_000],
        "tags": ["mcv"],
        "date": assignment.due_date,
        "endTime": assignment.end_time,
        "status": status,
        "automationSource": "mcv",
        "automationSourceKey": source_key,
    }
    update = {key: value for key, value in update.items() if value is not None}
    return create, update


def emit_actions(assignments: list[Assignment]) -> None:
    missing_times = [assignment.remote_id for assignment in assignments if assignment.end_time is None]
    if missing_times:
        raise RuntimeError(
            "Refusing to emit actions without endTime for assignments: "
            + ", ".join(missing_times)
        )

    actions: list[dict] = []
    for assignment in assignments:
        create, update = action_for(assignment)
        actions.extend((create, update))
    print(json.dumps({"actions": actions}, ensure_ascii=False))


def save_debug_artifacts(page) -> None:
    try:
        page.screenshot(path=str(PROFILE_DIRECTORY / "mcv-debug.png"), full_page=True)
        (PROFILE_DIRECTORY / "mcv-debug.html").write_text(page.content(), encoding="utf-8")
        log(f"Saved debug artifacts in {PROFILE_DIRECTORY}")
    except Exception as error:
        log(f"Could not save debug artifacts: {error}")


def main() -> int:
    args = parse_args()
    try:
        from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
        from playwright.sync_api import sync_playwright
    except ImportError:
        log("Playwright is not installed. Run: python3 -m pip install playwright")
        return 2

    try:
        username, password = get_credentials()
        PROFILE_DIRECTORY.mkdir(mode=0o700, parents=True, exist_ok=True)
        with sync_playwright() as playwright:
            context = playwright.chromium.launch_persistent_context(
                user_data_dir=str(PROFILE_DIRECTORY),
                headless=not args.headed,
                viewport={"width": 1440, "height": 1000},
            )
            page = None
            try:
                page = context.pages[0] if context.pages else context.new_page()
                ensure_authenticated(page, context, username, password)
                assignments = scrape_assignments(page, args.include_archived)
                if args.debug:
                    save_debug_artifacts(page)
                emit_actions(assignments)
                log(f"Emitted {len(assignments)} assignments")
            except Exception:
                if args.debug and page is not None:
                    save_debug_artifacts(page)
                raise
            finally:
                context.close()
    except PlaywrightTimeoutError as error:
        log(f"MCV page timed out: {error}")
        return 1
    except Exception as error:
        if "page" in locals() and page is not None:
            try:
                url = page.url() if callable(page.url) else page.url
                log(f"Page at {url} titled {page.title()!r}")
            except Exception:
                pass
        log(str(error))
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
