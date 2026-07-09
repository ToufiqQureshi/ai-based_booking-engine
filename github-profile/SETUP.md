# GitHub Profile README — Setup

This folder is a **ready-to-copy GitHub profile** (styled after
[mtwn105/mtwn105](https://github.com/mtwn105/mtwn105)).

## What's inside

```
github-profile/
├── README.md                          # the profile page itself
├── scripts/update_readme.py           # auto-lists your latest repos
└── .github/workflows/update-readme.yml# runs the script daily
```

## How to make it live on your GitHub profile

Your profile README lives in a special repo named exactly after your
username: **`ToufiqQureshi/ToufiqQureshi`** (it already exists).

1. Copy the contents of this folder into that repo's root:
   - `README.md`
   - `scripts/update_readme.py`
   - `.github/workflows/update-readme.yml`
2. Commit and push to `main`.
3. Open your profile — https://github.com/ToufiqQureshi — the README shows up.

## The automation

`.github/workflows/update-readme.yml` runs every day (and on manual trigger).
It calls `scripts/update_readme.py`, which fetches your most recently pushed
public repos from the GitHub API and refreshes the table between the
`<!-- RECENT-REPOS:START -->` and `<!-- RECENT-REPOS:END -->` markers.

- Uses the built-in `GITHUB_TOKEN` — no secrets to configure.
- Skips forks, archived repos, the profile repo, and `ai-based_booking-engine_old`.
- To trigger it by hand: repo → **Actions** → *Update README with Latest Repos* → **Run workflow**.

## Things to personalise

- **LinkedIn** — the badge points to `linkedin.com/in/toufiqqureshi`. Update if your handle differs.
- **Featured Projects** — six repo cards are hand-picked; add/remove `<img>` pins in the README.
- **Stats theme** — all cards use `theme=tokyonight`; swap for any
  [supported theme](https://github.com/anuraghazra/github-readme-stats#themes).
