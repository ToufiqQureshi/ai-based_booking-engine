import asyncio
import os
from google.antigravity import Agent, LocalAgentConfig

REPORT_FILE = "cleanup_report.md"

async def ask(agent, task):
    response = await agent.chat(task)
    return await response.text()

async def main():
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    config = LocalAgentConfig(api_key=api_key)
    report = []

    async with Agent(config) as agent:

        print("=== STEP 1: Backend endpoints ===")
        r1 = await ask(agent,
            "Search all files under backend/app/ recursively. "
            "Find every route defined with @router.get, @router.post, @router.put, @router.delete, @router.patch. "
            "Output a plain list: METHOD /path/to/route  (filename). Nothing else."
        )
        print(r1)
        report.append("## Backend Endpoints\n" + r1)

        print("\n=== STEP 2: Frontend API calls ===")
        r2 = await ask(agent,
            "Now search all .ts, .tsx files under frontend/src/ recursively. "
            "Find every API endpoint being called — look for strings containing /api/, "
            "axios/fetch calls, useQuery/useMutation hooks, and apiClient calls. "
            "Output a plain list of unique endpoint paths being called. Nothing else."
        )
        print(r2)
        report.append("## Frontend API Calls\n" + r2)

        print("\n=== STEP 3: Backend-only endpoints (no frontend usage) ===")
        r3 = await ask(agent,
            "Compare the backend endpoints list from Step 1 with the frontend API calls from Step 2. "
            "List ONLY the backend endpoints that are NOT called from the frontend at all. "
            "These are potentially dead backend routes."
        )
        print(r3)
        report.append("## Dead Backend Routes (no frontend usage)\n" + r3)

        print("\n=== STEP 4: Frontend calls with no backend endpoint ===")
        r4 = await ask(agent,
            "Now list ONLY the frontend API calls from Step 2 that do NOT have a matching backend endpoint from Step 1. "
            "These are broken frontend calls with no backend."
        )
        print(r4)
        report.append("## Broken Frontend Calls (no backend endpoint)\n" + r4)

        print("\n=== STEP 5: Dead code in backend ===")
        r5 = await ask(agent,
            "Search backend/app/ for dead code: "
            "1. Python functions defined but never called or imported anywhere in the project. "
            "2. Imports at top of files that are never used in that file. "
            "3. Variables assigned but never read. "
            "List each with: filename, line number, what it is. Be specific."
        )
        print(r5)
        report.append("## Backend Dead Code\n" + r5)

        print("\n=== STEP 6: Dead code in frontend ===")
        r6 = await ask(agent,
            "Search frontend/src/ for dead code: "
            "1. React components that are imported but never used in JSX anywhere. "
            "2. Exported functions/hooks that are never imported elsewhere. "
            "3. useState/useEffect variables that are set but never read. "
            "List each with filename and what it is."
        )
        print(r6)
        report.append("## Frontend Dead Code\n" + r6)

        print("\n=== STEP 7: Overly complex code ===")
        r7 = await ask(agent,
            "Look through both backend/app/ and frontend/src/ for code that is unnecessarily complex — "
            "for example: a simple operation done in 20+ lines that could be 3-5 lines, "
            "deeply nested if/else that could be flattened, "
            "repeated logic that should be a shared function. "
            "List the top 10 worst offenders with filename, line range, and why it's complex."
        )
        print(r7)
        report.append("## Overly Complex Code\n" + r7)

    # Save full report
    with open(REPORT_FILE, "w", encoding="utf-8") as f:
        f.write("# Codebase Cleanup Report\n\n")
        f.write("\n\n---\n\n".join(report))

    print(f"\n\nReport saved to {REPORT_FILE}")

if __name__ == "__main__":
    asyncio.run(main())
