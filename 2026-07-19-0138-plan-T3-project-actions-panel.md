# Plan — Task T3: project server actions + record side panel

## Goal
Implement T3 of ctcHealth Command Center MVP per `CONTRACTS.md` + the T3 task brief given in
conversation: `lib/actions/projects.ts`, `lib/actions/milestones.ts` (server actions, zod +
optimistic locking), and `components/project-panel/*` (Twenty-style Sheet record panel with
Details + Milestones tabs), consumed later by other tasks via `?project=` search param. Delete any
temp dev-only file before reporting. Do NOT commit (per task brief). Report exact exported
signatures + gate results as final message.

## Checklist
- [x] Read CONTRACTS.md, AGENTS.md, prisma/schema.prisma, lib/db.ts, lib/validation.ts,
      lib/types.ts, lib/health.ts, lib/session.ts, relevant components/ui/* primitives,
      lib/actions/people.ts (pattern reference), app/login/login-form.tsx (pattern reference),
      Next 16 docs on server actions / revalidatePath / useSearchParams.
- [x] `lib/actions/projects.ts` — createProject, updateProject (optimistic lock), setProjectStatus,
      setArchived. Exports `ProjectWithRelations` and `ProjectInput` types too.
- [x] `lib/actions/milestones.ts` — createMilestone (5-cap), updateMilestone (lock), deleteMilestone.
- [x] `components/project-panel/use-project-param.ts` — client hook (project, openNew, openProject, close).
- [x] `components/project-panel/people-picker.tsx` — OwnerPicker (single combobox) + MembersPicker
      (multi-select w/ chips), Command+Popover based.
- [x] `components/project-panel/details-tab.tsx` — full Details form (name, client, category,
      status, priority, owner, members, progress slider+number, start/end date, notes (added — see
      Decisions), archived badge, client zod validation, create/update submit, "Save and add
      another" in new mode, Enter-to-submit via native form semantics.
- [x] `components/project-panel/milestones-tab.tsx` — list sorted by dueDate, inline add row,
      inline edit row, delete via confirm Popover, "n/5" counter, done checkbox.
- [x] `components/project-panel/project-panel.tsx` — Sheet wrapper, mode 'new'|'edit'|'closed',
      Tabs only in edit mode, wires close() to onOpenChange.
- [x] Wrote temporary type-check wiring file at `components/project-panel/__dev__/wiring.tsx`.
      Found and fixed one real type error (mock object had spurious `createdBy`/`updatedBy`
      relation fields — `ProjectWithRelations`'s Prisma include only pulls `owner`/`members`/
      `milestones`, not the audit-relation objects, so those aren't on the type).
- [x] Ran gates: `npm run build` (pass, TS clean), `npm run lint` (pass, zero output), `npm run
      test` (pass, 11/11, pre-existing health.test.ts unaffected). No "another build process"
      lock conflict encountered.
- [x] Deleted `components/project-panel/__dev__/` and re-ran `npm run build` to confirm no
      regression — still clean.
- [ ] **NEXT STEP**: Send the final report message to the user/orchestrator (NOT a commit): list
      created files, gate results, exact exported signatures of every action + `ProjectPanelProps`/
      `ProjectPanelMode`, and the two disclosed deviations (Decisions section below). This plan
      file itself is scratch/handoff material, not a deliverable — fine to leave in repo root or
      remove once the report has been delivered (task brief doesn't ask for it to be committed
      either way since "Do NOT commit" applies to this whole task).

## Decisions
- Followed the literal T3 task brief prop shape `{ project, people, mode: 'new'|'edit'|'closed' }`
  over CONTRACTS.md's looser sketch `ProjectPanel({ project, people, open }?)` — task brief is the
  more specific, later instruction directed at me. Will disclose as a deviation in the final report.
- Added an optional **Notes** textarea to the Details tab even though the T3 bullet list didn't
  name it. Reason: `notes` is a real `Project` field in the shared Prisma schema and
  `projectInputSchema` (both owned by T1) — omitting it would make it permanently unsettable
  through the only edit UI. Low-risk, optional field. Will disclose as deviation.
- Progress control uses a native `<input type="range">` synced with a number `<Input>` — there is
  no shadcn `Slider` in `components/ui/*` (not installed, and I must not add deps/new shadcn
  components since I don't own `components/ui/*`). Native range satisfies "range slider synced"
  requirement without new deps.
- Optimistic-lock conflict message reused verbatim for projects ("Project changed while you were
  editing — reload and retry.") per CONTRACTS.md. For milestones (no exact string specified) used
  the analogous "Milestone changed while you were editing — reload and retry."
- `ProjectWithRelations` and `ProjectInput` types defined/exported from `lib/actions/projects.ts`
  (not `lib/types.ts`, which is T1-owned) since the panel needs them and I own the actions file.
- Each server action starts with a local `requireSessionResult()` helper (duplicated verbatim in
  both `projects.ts` and `milestones.ts` — small, intentional duplication rather than inventing a
  shared util file not specified in CONTRACTS, per "simplicity first / no premature abstraction").
- Working directly on `main` branch, no commit (per explicit task-brief instruction "Do NOT
  commit"). No git worktree used — matches how T1's commit already landed directly and the task
  brief's own instructions supersede the general skill default.

## Current state
All 3 code-writing tasks (projects.ts, milestones.ts, components/project-panel/*) are done and
believed correct but **UNVERIFIED** — no typecheck/build/lint/test has been run yet against this
code. This is the single biggest risk: shadcn component prop APIs (Select onValueChange, Checkbox
onCheckedChange, Popover/Command props, Badge/Button variants) were inferred by reading the actual
`components/ui/*` source files in this repo (not from training-data memory), but there may still be
TS errors (e.g. zod `issues` path typing, Prisma `Milestone`/`Person` field name mismatches,
`ProjectWithRelations` include shape vs actual Prisma include result type, unused imports lint
errors, `dateOnlyUTC` argument type mismatches with `Date | string` project fields as received
client-side).

Files written this session (all new, none pre-existing):
- `lib/actions/projects.ts`
- `lib/actions/milestones.ts`
- `components/project-panel/use-project-param.ts`
- `components/project-panel/people-picker.tsx`
- `components/project-panel/details-tab.tsx`
- `components/project-panel/milestones-tab.tsx`
- `components/project-panel/project-panel.tsx`

No file outside my T3 ownership scope (`lib/actions/*` except `people.ts`/`ideas.ts`, and
`components/project-panel/*`) has been touched.

## Next steps (exact)
1. Write `components/project-panel/__dev__/wiring.tsx`:
   ```tsx
   import type { Person } from "@prisma/client";
   import { ProjectPanel } from "@/components/project-panel/project-panel";
   import type { ProjectWithRelations } from "@/lib/actions/projects";

   const person: Person = { id: "p1", name: "Test Person", active: true, canLogin: true, createdAt: new Date() };
   const project: ProjectWithRelations = {
     id: "proj1", name: "Test", client: "Acme", category: "tech", status: "planning",
     priority: "medium", ownerId: "p1", owner: person, progress: 50, archived: false,
     startDate: new Date(), endDate: new Date(), notes: null, version: 1,
     createdAt: new Date(), createdById: "p1", createdBy: person,
     updatedAt: new Date(), updatedById: "p1", updatedBy: person,
     members: [], milestones: [],
   };

   export function Wiring() {
     return <ProjectPanel project={project} people={[person]} mode="edit" />;
   }
   ```
   (Adjust field names/types to exactly match `prisma/schema.prisma` if any mismatch — check
   generated Prisma types if this doesn't compile, e.g. run `npx prisma generate` if
   `@prisma/client` types look stale.)
2. Run `npm run build`. If it fails with "Another next build process is already running", wait 60s,
   retry, up to 5 times.
3. Fix any TS errors surfaced — likely candidates: Select `onValueChange` type (string vs union),
   Checkbox `onCheckedChange` signature, `mapIssues` issue-path typing in `details-tab.tsx`, Prisma
   `Milestone.dueDate` being `Date` at runtime but typed as needed for `toDateInputValue`.
4. Run `npm run lint`. Fix unused-import / any other ESLint errors (e.g. unused `atCap` variable,
   unused icon imports if trimmed during fixes).
5. Run `npm run test` (should be unaffected — no new test files were added or expected for T3
   per the task brief; T1 owns `lib/__tests__/*`).
6. Delete `components/project-panel/__dev__/` entirely once gates pass.
7. Re-run `npm run build` once more after deletion to confirm nothing regressed from removing the
   dev file (it shouldn't, since nothing imports it).
8. Write the final report message per the task brief's "Report" section: created/changed files,
   gate results (pass/fail + key output), exact exported signatures of `createProject`,
   `updateProject`, `setProjectStatus`, `setArchived`, `createMilestone`, `updateMilestone`,
   `deleteMilestone`, and `ProjectPanelProps`/`ProjectPanelMode`, plus the two disclosed deviations
   (prop shape `mode` vs `open`, added Notes field). Do NOT commit.

## Blockers
None yet — purely mechanical verification + fix-up work remains. If `npm run build` reveals a
CONTRACTS.md conflict (e.g. a real API mismatch in `lib/session.ts` or `lib/validation.ts` that
makes an agreed signature impossible), STOP and report rather than inventing an alternative, per
CONTRACTS.md's own instruction.
