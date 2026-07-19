# T6 deadline notifications and archived projects plan

## Goal

Implement the T6 deadline alert and archived-project management surfaces so signed-in people see session-scoped deadline notifications and can unarchive one or many archived projects, while preserving the ownership boundaries in `CONTRACTS.md` and leaving the parallel projects-table work untouched.

## Checklist

- [x] Read T6 contracts, Next.js 16 App Router guidance, shared data/actions, shell, UI primitives, and available project-list patterns.
- [x] Add the client deadline alert and server data wrapper under `components/notifications/`.
- [x] Mount the deadline wrapper between the top bar and page content in `app/(app)/layout.tsx`.
- [x] Add the `/archived` server page and interactive unarchive table under `app/(app)/archived/`.
- [x] Review the scoped diff and verify no parallel-owner paths were changed.
- [ ] Run `npm run build`.
- [x] Run `npm run lint`.
- [x] Run `npm run test`.

## Decisions

- Classify deadlines as mutually exclusive groups after UTC date-only normalization: overdue is before today; due within seven days is today through today + 7 days, inclusive.
- Serialize dates and computed health from the server wrapper so the client performs no independent health or timezone-sensitive deadline calculation.
- Use person-specific `sessionStorage` keys for both the once-per-session toast and dismissible banner.
- Use the existing shadcn table, checkbox, badge, and button primitives for the archived view; no new dependency or server action is needed.

## Current state

The full lint and test gates pass, and a standalone TypeScript check passes. The build gate is waiting on the sandbox-blocked Google Fonts fetch.

## Next steps

Create the two notification components, minimally mount the server wrapper in the app layout, then create and verify the archived page and client table.

## Blockers

- `npm run build` cannot fetch the configured Geist and Geist Mono stylesheets from Google Fonts in the network-restricted sandbox; the requested scoped network retry was denied by the environment safety review.
