# AI Assistant Page — Complete Requirements

> Written 2026-06-29. Source of truth for feature behaviour, known bugs, and acceptance criteria.

---

## 1. Page Layout

| Area | Description |
|---|---|
| Left sidebar (280px) | "New Chat" button at top + scrollable session list |
| Main panel | Header + message thread + quick-prompt chips + input bar |
| Header tabs | Chat / Usage toggle |

---

## 2. Sidebar — Session List

### 2.1 Session item
- Shows chat icon + session name (truncated to one line)
- **Name**: first 60 chars of the first user message (auto-set after first reply)
- **Active session**: highlighted with `bg-secondary`
- **Hover state**: pencil icon (rename) + trash icon (delete) appear on the right

### 2.2 Rename
- Click pencil → inline `<input>` replaces the name text in-place
- `Enter` saves, `Escape` cancels, clicking outside cancels
- API: `PATCH /api/v1/agent/sessions/{id}/rename { session_name }`
- Immediately updates the sidebar label on success

### 2.3 Delete
- Click trash → immediately removes that item from the sidebar (optimistic)
- If the deleted session was active → `clearChat()` (new empty chat)
- API: `DELETE /api/v1/agent/sessions/{id}`
- No confirmation dialog (single click — same as ChatGPT)

### 2.4 New Chat button
- Clears messages, sets `activeSessionId = null`
- Does NOT create a session in the DB yet — session is only created when the first message is sent

### 2.5 Session isolation
- Each session stores its own message history in `agno_sessions` Postgres table keyed by `session_id` (UUID)
- When `session_id = null` is sent to the backend, Agno auto-generates a new UUID
- The agent loads history ONLY for the given `session_id` → zero cross-session context bleed
- `num_history_runs = 10` so only last 10 turns of THAT session are loaded

---

## 3. Chat — Message Flow

### 3.1 Sending a message
1. User types in input box and presses Enter or clicks Send
2. User message appears immediately as a red bubble (right-aligned)
3. Input is cleared and disabled while AI is responding
4. AI response streams token-by-token into a live bubble (left-aligned)

### 3.2 Streaming states (3 phases)

| Phase | UI | Trigger |
|---|---|---|
| **Waiting** | Three bouncing dots | From send until first event arrives |
| **Tool call** | Spinner + "Fetching data…" | `TeamToolCallStarted` or `ToolCallStarted` event |
| **Streaming text** | Partial AI text + blinking cursor | `TeamRunContent` or `RunContent` event with `content` |

After streaming ends → text is committed to messages list, bubble disappears, input re-enabled.

### 3.3 Session naming (auto)
- On first message of a NEW session (no `session_id`), after `TeamRunCompleted` event → backend calls `rename_session(session_id, session_name=first_message[:60])`
- Sidebar refreshes to show the new name

### 3.4 Quick-prompt chips
- Show on empty/new chat only
- Categories: Operations, Revenue & Analytics, Guests & Rooms
- Clicking a chip fills the input and sends immediately

---

## 4. Backend API Endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/v1/agent/chat/stream` | SSE streaming chat (primary) |
| `GET` | `/api/v1/agent/sessions` | List user's sessions (latest 50) |
| `GET` | `/api/v1/agent/sessions/{id}` | Load message history for a session |
| `PATCH` | `/api/v1/agent/sessions/{id}/rename` | Rename a session |
| `DELETE` | `/api/v1/agent/sessions/{id}` | Delete a session |
| `GET` | `/api/v1/agent/usage` | AI token usage stats |

### 4.1 SSE Event format (`/chat/stream`)

```
data: {"type":"tool","name":"get_pending_bookings"}\n\n
data: {"type":"content","delta":"Here are your bookings..."}\n\n
data: {"type":"done","session_id":"<uuid>"}\n\n
data: {"type":"error","message":"..."}\n\n
```

### 4.2 Agno event mapping (backend)

Agno emits TWO layers of events:
- **Team-level** (prefix `Team`): `TeamRunContent`, `TeamToolCallStarted`, `TeamRunCompleted`
- **Member-agent level** (no prefix): `RunContent`, `ToolCallStarted`, `RunCompleted`

The backend MUST handle BOTH layers:

```python
CONTENT_EVENTS = {"TeamRunContent", "RunContent"}
TOOL_EVENTS    = {"TeamToolCallStarted", "ToolCallStarted"}
DONE_EVENTS    = {"TeamRunCompleted"}   # only Team-level has session_id
```

### 4.3 Session/DB helpers
- `_make_agent_db()` — creates just `AsyncPostgresDb` without LLM/tools (for sessions endpoints)
- `delete_session(session_id)` — takes ONLY `session_id`, no `session_type`
- `rename_session(session_id, session_type, session_name)` — needs `SessionType.TEAM`
- `get_session(session_id, session_type)` — needs `SessionType.TEAM`

---

## 5. Known Bugs (pre-fix)

| # | Bug | Root Cause | Fix |
|---|---|---|---|
| B1 | Streaming text never appears | Backend only checks `TeamRunContent`, ignores `RunContent` from member agents | Add `RunContent` to content event set |
| B2 | Delete fails with "Could not delete chat" | `delete_session()` was called with invalid `session_type=` kwarg | Already fixed in commit `2107b2b` |
| B3 | Rename/pencil icons missing | `group-hover:flex` only works on CSS hover; icons hidden unless hovering precisely; on active session they should always show | Always show icons on active session; improve hover UX |
| B4 | SSE line parsing drops partial chunks | `chunk.split('\n')` breaks if a data line is split across two reads | Use a line buffer that accumulates across reads |
| B5 | Old sessions all named "New Chat" | Pre-fix sessions before `rename_session` was added | Not fixable for old sessions; new sessions work correctly |
| B6 | `import('@/core/api/client')` in sendMessage | Dynamic import works but adds latency and is fragile in some bundlers | Move `API_BASE_URL` + `tokenStorage` to a helper used at top level |

---

## 6. Acceptance Criteria

- [ ] Send a message → user bubble appears instantly, bouncing dots show, then text streams character by character
- [ ] Tool call (e.g. "show pending bookings") → "Fetching data…" appears before text streams
- [ ] After response → new session appears in sidebar with first-message text as name
- [ ] Click past session → "Loading chat…" appears, then full history loads (no "Thinking…" / "Fetching data…")
- [ ] Hover over session → pencil + trash icons appear
- [ ] Click pencil → inline rename, Enter saves, Escape cancels
- [ ] Click trash → session removed from list; if active → new chat screen
- [ ] Two separate chat sessions have zero context bleed between them
- [ ] No tokens consumed for session list / history / rename / delete
