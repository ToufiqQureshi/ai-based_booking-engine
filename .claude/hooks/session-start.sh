#!/bin/bash
set -uo pipefail

# Only needed in Claude Code on the web — local devs already have their own venv/CLI setup.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"

# graphify CLI — the project's knowledge-graph skill (.claude/skills/graphify) needs the
# binary on PATH. It is not vendored in the repo, so each fresh container needs it installed.
if ! command -v graphify >/dev/null 2>&1; then
  if command -v uv >/dev/null 2>&1; then
    uv tool install graphifyy >/dev/null 2>&1
  else
    pip install --user --quiet graphifyy >/dev/null 2>&1
  fi
fi
if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo "export PATH=\"$HOME/.local/bin:\$PATH\"" >> "$CLAUDE_ENV_FILE"
fi

# Backend Python deps — needed for the Stop hook's pytest run and for any manual testing.
# --ignore-installed works around distro-installed packages (e.g. Debian's PyJWT) that pip
# can't upgrade in place because they have no RECORD file.
if [ -f "$PROJECT_DIR/backend/requirements.txt" ]; then
  pip install --quiet --ignore-installed -r "$PROJECT_DIR/backend/requirements.txt" >/dev/null 2>&1
fi

exit 0
