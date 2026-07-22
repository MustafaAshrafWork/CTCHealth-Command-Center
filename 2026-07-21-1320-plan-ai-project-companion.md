# Plan — AI project companion (read / create / edit / delete)

## Goal
Extend the existing intake-only chat (`ProjectChat`) into a single auto-detecting
assistant that can, over the same chat box: (a) answer questions about existing
projects the signed-in user can see, (b) draft a new project (existing flow), (c)
propose an edit to an existing project, (d) propose a delete. Every write still
goes through a confirm step and the existing server actions (authz + version lock
re-checked server-side). AI sees ALL project fields for visible (isDemo-scoped)
projects incl. archived + notes — this is demo data; hardening is a later task.

## Decisions
- **One chat, auto-detect intent** (user pick). AI returns a discriminated
  envelope with an `action` field: `answer | create | edit | delete`.
- **Data scope**: send every project in the user's isDemo partition (active +
  archived), all fields incl. notes. Owner/members by name. Demo data → OK for now.
- **Edit**: `updateProject(id, version, fullInput)` needs the FULL input. AI returns
  the complete merged draft for the target project + its id. Client passes the
  current `version` it already loaded (server 409s on stale → surfaced as retry).
- **Delete**: `removeProject` only deletes ARCHIVED projects. So AI "delete" maps to
  **archive** (reversible) via `setArchived(id, true)` when active; if already
  archived, propose permanent `removeProject`. Keeps destructive path safe.
- Reuse existing server actions unchanged — AI proposes, confirm executes, server
  re-authorizes. No new trust surface on the write path.
- Q&A/answer path returns free text (no JSON responseSchema) — needs provider to
  allow a non-JSON generate. Add `json?: boolean` to GenerateRequest, or run the
  whole agent as one JSON envelope where `answer` carries a `message` string.
  → Chosen: keep ONE JSON envelope (schema stays), `action: "answer"` just fills
  `message`. No provider change needed. Simpler + keeps structured parsing.

## Checklist
- [ ] 1. `project-agent.ts`: widen envelope to `action: answer|create|edit|delete`.
      - answer → {message}
      - create → {message, draft} (today's ready draft)
      - edit   → {message, targetProjectId, draft (full)}
      - delete → {message, targetProjectId, mode: archive|permanent}
      Add Gemini responseSchema branches + zod discriminated union.
      Verify: unit test per action shape parses.
- [ ] 2. `project-agent.ts`: new `buildProjectContext(projects)` → compact text
      block of all visible projects (id, name, client, owner, category, status,
      dates, budget+currency, progress, atRisk from notes, archived, members,
      notes). Injected into system prompt. Verify: snapshot test.
- [ ] 3. System prompt rewrite: describe the 4 actions + the project list context +
      rules (never invent a projectId; only use ids from the list; edit returns full
      draft; delete picks archive vs permanent by the project's archived flag).
- [ ] 4. `route.ts`: load visible projects (isDemo scope, incl. archived) and pass
      to agent. Add confirm branches: `action: "edit"` → updateProject; `action:
      "delete"` → setArchived or removeProject. Keep chat/create branches.
      Verify: tsc + existing tests green.
- [ ] 5. `provider`/schema: no change if single-JSON-envelope approach holds.
- [ ] 6. Client `project-chat.tsx`: render answer messages (already text), and a
      new confirm card variant for edit + delete (show target project + change /
      deletion, Confirm/Cancel). Pass through version for edit.
- [ ] 7. `project-confirm-card.tsx` (or new cards): edit-confirm + delete-confirm UI.
- [ ] 8. Update sheet description copy (mentions ask/create/edit/delete).
- [ ] 9. Tests: extend `project-agent.test.ts` for new actions + context builder.
- [ ] 10. tsc + vitest + eslint all green.

## Current state (2026-07-21, ~mid-build)
DONE:
- [x] 1-3. `lib/ai/project-agent.ts` fully rewritten:
      - Envelope now `action: answer|create|edit|delete` (discriminated zod union
        `agentEnvelopeSchema`). `ProjectAgentTurn` is a matching union.
      - Gemini schema: `action` enum + `targetProjectId` (nullable) added; `status`
        removed; required = [message, action, targetProjectId, draft].
      - `buildProjectContext(ProjectSummary[])` + `ProjectSummary` type exported.
      - System prompt rewritten (4 actions + EXISTING PROJECTS context + OUTPUT
        examples). `buildSystemPrompt` takes projectContext arg.
      - `runProjectAgent` now takes `projects: ProjectSummary[]`, validates owner on
        create/edit and that edit/delete targetProjectId exists in context.
      - Added `buildEditProjectInput(draft, ownerId, current)` — preserves
        status/priority/progress/completed/memberIds/notes; only briefing fields change.
- [x] 4. `app/api/chat/route.ts` rewritten: loads `fetchProjectContext(session)`
      (isDemo scope, incl archived, with owner+member names + notes), passes to agent.
      Chat response now `{ ok, turn }` (whole union). Added confirm variants:
      `confirm-edit` (reads current version+state, calls updateProject) and
      `confirm-delete` (archived→removeProject, else setArchived([{id,version}],true)).
      `statusForCode` helper. Session type from @/lib/types (NOT session.ts).
      TSC clean for route.ts.
- [x] 6. `components/chat/project-chat.tsx`: `draft` state → `pending: PendingAction`
      union (create|edit|delete). Response type `AgentTurn`. sendMessages parses turn
      → setPending. handleConfirm dispatches by kind to confirm/confirm-edit/
      confirm-delete. handleCancelAction. Rendering: 3 cards. Header copy broadened.
      Imports ProjectEditCard + ProjectDeleteCard (NOT YET CREATED — see next).

## FOLLOW-UP TASK (2026-07-21, after first build) — IN PROGRESS
User reported TWO things:
1. BUG (critical, fix first): asking the AI about existing projects returns
   HTTP 502 "The AI assistant returned an error." — Gemini call fails with the
   new widened responseSchema + project context. User has 2 active projects,
   0 archived. Root cause NOT yet confirmed.
   - DEBUG IN PLACE: `lib/ai/gemini.ts` — added TEMP `console.error("[gemini]
     non-OK response", status, errorBody)` before the UPSTREAM throw (~line 83).
     MUST REMOVE this temp logging once fixed.
   - WAITING ON USER: they will paste the `[gemini] non-OK response <status>
     {json}` line from the dev terminal. Prime suspect: the Gemini
     `GEMINI_RESPONSE_SCHEMA` in `lib/ai/project-agent.ts` — the `action` field
     uses `enum: ["answer","create","edit","delete"]`; Gemini may need
     `format: "enum"` alongside type STRING, OR the nullable `draft` object with
     all-required inner fields + the added `targetProjectId` nullable string is
     rejected. category/currency enums already worked before, so enum-on-string
     itself is probably OK. Inspect schema first once the log arrives.
   - Likely fix candidates: (a) add `format: "enum"` to the action property;
     (b) the total schema may be invalid because a nullable OBJECT (draft) can't
     also be `required` at top level — but it was required before and worked, so
     more likely the NEW additions. Read the actual 400 body — do not guess.

2. FEATURE (independent of bug): a Claude-style "thinking" indicator while the
   AI answers — an animated icon + a word that cycles (Thinking… Pondering…
   Reticulating…) every ~1.5s. Show it in place of/above the input while
   `chatPending` is true.
   - IN PROGRESS in `components/chat/project-chat.tsx`:
     - DONE: imported `Sparkles` from lucide-react (alongside MessageCircle).
     - TODO next: add a `THINKING_WORDS` const array + a `<ThinkingIndicator/>`
       component (uses setInterval to cycle a word index every ~1500ms, cleans
       up on unmount; renders a pulsing Sparkles icon + current word in an
       assistant-style muted bubble with `animate-pulse` on the icon).
     - TODO: render `{chatPending && <ThinkingIndicator/>}` inside the messages
       scroll area, right AFTER the messages.map() and BEFORE the pending cards
       (or before the error block). It's the last item before `<div ref=bottomRef>`.
   - Verify: tsc + eslint clean. No browser test unless user asks.

## FIRST-BUILD STATUS: COMPLETE (2026-07-21-1334)
All items done. tsc 0 errors, eslint clean, vitest 107/107 pass (+4 new).
Cards created, tests migrated to action-based envelope. NOT committed, NOT browser-tested.
Known minor: buildEditProjectInput drops sharePointLink (edit clears it) — POC-acceptable.

## Next steps (EXACT) — DONE, kept for reference
1. CREATE the two new cards in `components/chat/project-confirm-card.tsx`:
   - `ProjectEditCard({ draft, pending, onConfirm, onCancel })` — like ProjectConfirmCard
     but header "Confirm changes", button "Save changes". Reuse the same dl grid.
   - `ProjectDeleteCard({ pending, onConfirm, onCancel })` — destructive styling,
     "Delete project" confirm button, note that active projects are archived.
   Both must be `export`ed. project-chat.tsx already imports all three by name.
2. Run: `npx tsc --noEmit` — fix any remaining type errors.
3. Item 9: update `lib/__tests__/project-agent.test.ts` — runWith now needs
   `projects: []`; assertions use `turn.action`/`turn.draft` not `.draft` directly;
   validDraft already has currency. Add a couple tests for answer/edit/delete + context.
4. Run: `npx vitest run` + `npx eslint` on all touched files. All green.
5. Report to user. NOT committed (standing order). NOT browser-tested.

## Files touched
- lib/ai/project-agent.ts (done)
- app/api/chat/route.ts (done)
- components/chat/project-chat.tsx (done)
- components/chat/project-confirm-card.tsx (NEEDS 2 new exported cards)
- lib/__tests__/project-agent.test.ts (NEEDS update)

## Blockers
None. (Edit needs the target project's current `version` client-side — the chat
must fetch it; plan: server returns version inside the answer/edit context, OR
confirm re-reads it. Decide during item 4/6: simplest = confirm branch re-reads
current version server-side before updateProject, so client need not track it.)
```
```
