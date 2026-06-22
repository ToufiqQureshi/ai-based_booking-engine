#!/usr/bin/env python3
"""Stop hook: if backend .py files changed this turn, run pytest and block
finishing until it's green (capped at 3 attempts to avoid an infinite loop)."""
import json
import os
import pathlib
import subprocess
import sys

data = json.load(sys.stdin)
project_dir = os.environ.get("CLAUDE_PROJECT_DIR", os.getcwd())
session_id = data.get("session_id", "default")

os.chdir(project_dir)

diff = subprocess.run(
    ["git", "diff", "--name-only", "HEAD"], capture_output=True, text=True
).stdout
diff += subprocess.run(
    ["git", "diff", "--cached", "--name-only", "HEAD"], capture_output=True, text=True
).stdout

backend_py_changed = any(
    line.startswith("backend/") and line.endswith(".py") for line in diff.splitlines()
)
if not backend_py_changed:
    sys.exit(0)

counter_file = pathlib.Path(f"/tmp/claude-stop-pytest-{session_id}.count")
attempts = int(counter_file.read_text()) if counter_file.exists() else 0

MAX_ATTEMPTS = 3
if attempts >= MAX_ATTEMPTS:
    counter_file.unlink(missing_ok=True)
    sys.exit(0)

result = subprocess.run(
    ["python3", "-m", "pytest", "-x", "-q", "--tb=short"],
    cwd=os.path.join(project_dir, "backend"),
    capture_output=True,
    text=True,
)

if result.returncode != 0:
    counter_file.write_text(str(attempts + 1))
    tail = "\n".join((result.stdout + result.stderr).splitlines()[-50:])
    print(
        json.dumps(
            {
                "decision": "block",
                "reason": (
                    f"pytest failed after your changes (attempt {attempts + 1}/{MAX_ATTEMPTS}). "
                    f"Fix the failure before finishing:\n\n{tail}"
                ),
            }
        )
    )
else:
    counter_file.unlink(missing_ok=True)

sys.exit(0)
