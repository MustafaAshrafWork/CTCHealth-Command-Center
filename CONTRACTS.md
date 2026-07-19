# CONTRACTS.md — shared contracts for all implementers

Read this whole file before writing code. It is the integration contract between parallel
implementers. Do not deviate from names/paths/signatures here; if a contract is impossible,
STOP and report — do not invent an alternative.

Authoritative scope/stack: `../2026-07-18-2147-plan-phase1-command-center.md` (plan v2).
Next.js is 16.2.10 — APIs differ from your training data. Read the relevant pages under
`node_modules/next/dist/docs/` before writing code (async `params`/`searchParams`, App Router
conventions). React 19. Tailwind 4 (CSS-first config in `app/globals.css`).

## Routes

| Route | Purpose | Owner task |
|---|---|---|
| `/login` | persona picker (7 buttons) + create-new | T2 |
| `app/(app)/layout.tsx` | route guard + app shell (sidebar/topbar) | T2 |
| `/` → redirect `/projects` | | T2 |
| `/projects` | list view (Twenty-style table) + side panel | T5 (panel itself T3) |
| `/board` | kanban by status | T7 |
| `/timeline` | Gantt | T4 |
| `/ideas` | ideas list | T8 |
| `/archived` | archived projects + unarchive | T6 |
| `/changelog` | renders CHANGELOG.md + MVP badge | T8 |

## File ownership (do not edit files owned by another task)

- T1: `package.json`, `prisma/*`, `lib/db.ts`, `lib/health.ts`, `lib/validation.ts`, `lib/types.ts`, `components/ui/*` (shadcn), `vitest.config.ts`, `lib/__tests__/*`
- T2: `app/(app)/layout.tsx`, `app/login/*`, `lib/session.ts`, `lib/actions/people.ts`, `app/globals.css` tokens, `components/shell/*`, `app/layout.tsx`, `app/page.tsx`, placeholder `app/(app)/projects/page.tsx` (T5 replaces it)
- T3: `lib/actions/*` EXCEPT `people.ts` (T2's) and `ideas.ts` (T8's), `components/project-panel/*`
- T4: `app/(app)/timeline/*`, `components/gantt/*`
- T5: `app/(app)/projects/*`, `components/projects-table/*`
- T6: `components/notifications/*`, `app/(app)/archived/*`
- T7: `app/(app)/board/*`, `components/kanban/*`
- T8: `components/notes/*`, `components/ideas/*`, `app/(app)/ideas/*`, `app/(app)/changelog/*`, `CHANGELOG.md`

ONLY T1 touches `package.json` / lockfile. All deps preinstalled — if a dep is missing, STOP and report.
Ownership guards apply between tasks running in the same wave; a later-wave task may extend an
earlier task's file ONLY when its brief explicitly says so.

## Data model

Prisma 7 + `@prisma/adapter-better-sqlite3`, SQLite `prisma/dev.db`, WAL mode. Schema per plan v2 §5.
String enums (SQLite): `category`: `tech|consultancy|agency|agents` · `status`: `planning|active|on_hold|completed` · `priority`: `high|medium|low`. IDs: cuid strings. Dates stored as date-only normalized UTC midnight.
Import client from `@/lib/db` (`db` singleton). Never instantiate PrismaClient elsewhere.

## Session API (`@/lib/session.ts`, T1 types + T2 impl)

```ts
type Session = { personId: string; name: string }
createSession(person: { id: string; name: string }): Promise<void>   // sets HMAC cookie 'cc_session' (jose HS256, env SESSION_SECRET)
getSession(): Promise<Session | null>
requireSession(): Promise<Session>       // throws in actions; guard layout redirects to /login
destroySession(): Promise<void>
```

EVERY server action starts with `await requireSession()` and returns `{ ok:false, code:'UNAUTHORIZED' }` shape on failure — cookie check in the action itself, not only layout.

## Server action return shape (T3, consumed by T5/T6/T7/T8)

```ts
type ActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; code: 'VALIDATION' | 'CONFLICT' | 'UNAUTHORIZED' | 'NOT_FOUND' | 'ERROR'; error: string }
```

`lib/actions/projects.ts`: `createProject(input)`, `updateProject(id, version, input)`, `setProjectStatus(id, version, status)`, `setArchived(projects: { id: string; version: number }[], archived: boolean)`
`lib/actions/milestones.ts`: `createMilestone(projectId, input)`, `updateMilestone(id, version, input)`, `deleteMilestone(id, version)`
`lib/actions/people.ts`: `createPerson(name)`, `loginAs(personId)` (T2)
`lib/actions/ideas.ts`: `createIdea(text)` (T8)
Optimistic locking: `UPDATE … WHERE id=? AND version=?`; miss → `code:'CONFLICT'`, message "Project changed while you were editing — reload and retry." All writes record `createdById`/`updatedById` from session. All mutations `revalidatePath` the affected routes.

## Health API (`@/lib/health.ts`, T1)

```ts
type Health = 'green' | 'amber' | 'red'
computeHealth(p: { status: string; endDate: Date; progress: number }, today?: Date): Health
healthLabel(h: Health): string
```
Rules (plan v2 §6, in order): completed→green · overdue OR due≤1d→red · ≤14d && progress<80→red · ≤30d && progress<50→amber · else green. Single shared function — no view reimplements it.

## Side panel contract (T3 provides, T5/T6 consume)

`components/project-panel/project-panel.tsx` exports client component
`ProjectPanel({ project, people, open }?)` — pages read awaited `searchParams.project`
(`'new'` or project id), fetch data server-side, render panel. Close = clear `?project=` via
`router.replace`. Save-and-add-another keeps panel open with empty form.

## UI conventions

- Twenty CRM look: zinc/neutral b/w, color ONLY for meaning (health green/amber/red; priority/status chips). shadcn/ui components from `components/ui/*`; icons `lucide-react`; toasts `sonner` (`<Toaster/>` mounted in the root `app/layout.tsx` so login errors are visible).
- Tailwind 4 tokens: use CSS variables defined in `app/globals.css` (`--background`, `--foreground`, shadcn vars). No hardcoded hex in components.
- NEVER `dangerouslySetInnerHTML` / `innerHTML`. React rendering only (v47 prototype had stored XSS — do not port it).
- Client components only where interactivity requires; server components default.
- All user-visible mutations show toast on success/failure; buttons disabled while pending (duplicate-submit protection).

## Gates (run before reporting done)

```bash
npm run build      # must pass
npm run lint       # must pass
npm run test       # vitest, must pass (T1 adds script)
npm run seed       # idempotent, T1 adds script
```

Do NOT commit. Do NOT push. Report changed files + gate results as final message.
