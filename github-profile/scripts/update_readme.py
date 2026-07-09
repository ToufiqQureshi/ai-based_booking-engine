#!/usr/bin/env python3
"""
Update README.md with the latest public GitHub repositories.

Fills the section between the <!-- RECENT-REPOS:START --> and
<!-- RECENT-REPOS:END --> markers with the most recently pushed repos.
Runs daily via .github/workflows/update-readme.yml.
"""

import os
import re
import html
import requests
from datetime import datetime

# --- Configuration ---------------------------------------------------------
GITHUB_USERNAME = os.getenv("GITHUB_USERNAME", "ToufiqQureshi")
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")   # provided automatically in Actions
MAX_REPOS = 6
# Repos we never want to show (e.g. the profile repo itself, stale mirrors)
EXCLUDE = {GITHUB_USERNAME.lower(), "ai-based_booking-engine_old"}

LANG_EMOJI = {
    "Python": "🐍",
    "JavaScript": "🟨",
    "TypeScript": "🔷",
    "Jupyter Notebook": "📓",
    "HTML": "🌐",
    "CSS": "🎨",
    "Java": "☕",
    "Go": "🐹",
    "Shell": "🐚",
}


def fetch_repos():
    """Return the user's non-fork, non-archived repos sorted by last push."""
    headers = {"Accept": "application/vnd.github+json"}
    if GITHUB_TOKEN:
        headers["Authorization"] = f"Bearer {GITHUB_TOKEN}"

    repos = []
    page = 1
    while True:
        url = (
            f"https://api.github.com/users/{GITHUB_USERNAME}/repos"
            f"?sort=pushed&direction=desc&per_page=100&page={page}&type=owner"
        )
        resp = requests.get(url, headers=headers, timeout=20)
        resp.raise_for_status()
        batch = resp.json()
        if not batch:
            break
        repos.extend(batch)
        if len(batch) < 100:
            break
        page += 1

    filtered = [
        r for r in repos
        if not r.get("fork")
        and not r.get("archived")
        and r.get("name", "").lower() not in EXCLUDE
    ]
    return filtered[:MAX_REPOS]


def build_rows(repos):
    """Build the HTML table rows for the repo list."""
    if not repos:
        return ""

    rows = []
    for r in repos:
        name = html.escape(r["name"])
        link = r["html_url"]
        desc = html.escape(r.get("description") or "—")
        lang = r.get("language") or "—"
        emoji = LANG_EMOJI.get(lang, "📦")
        lang_label = f"{emoji} {html.escape(lang)}" if lang != "—" else "—"
        stars = r.get("stargazers_count", 0)
        star_label = f" ⭐{stars}" if stars else ""

        pushed = r.get("pushed_at")
        date_str = "—"
        if pushed:
            date_str = datetime.strptime(pushed, "%Y-%m-%dT%H:%M:%SZ").strftime("%b %d, %Y")

        row = (
            f'<tr><td>📌 <a href="{link}">{name}</a>{star_label}</td>'
            f"<td>{desc}</td><td>{lang_label}</td><td>{date_str}</td></tr>"
        )
        rows.append(row)

    return "\n  " + "\n  ".join(rows) + "\n  "


def update_readme(rows):
    """Replace the RECENT-REPOS marker block with fresh rows."""
    with open("README.md", "r", encoding="utf-8") as f:
        readme = f.read()

    pattern = r"<!-- RECENT-REPOS:START -->.*?<!-- RECENT-REPOS:END -->"
    replacement = f"<!-- RECENT-REPOS:START -->{rows}<!-- RECENT-REPOS:END -->"
    new_readme = re.sub(pattern, replacement, readme, flags=re.DOTALL)

    if new_readme == readme:
        print("No changes to README.")
        return

    with open("README.md", "w", encoding="utf-8") as f:
        f.write(new_readme)
    print("README.md updated with latest repositories.")


def main():
    print(f"Fetching latest repos for {GITHUB_USERNAME}...")
    repos = fetch_repos()
    print(f"Found {len(repos)} repos to list.")
    rows = build_rows(repos)
    update_readme(rows)


if __name__ == "__main__":
    main()
