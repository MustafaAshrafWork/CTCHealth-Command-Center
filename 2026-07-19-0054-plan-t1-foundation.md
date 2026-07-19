# T1 Foundation Implementation Plan

## Goal

Implement the T1-owned foundation for the ctcHealth Command Center MVP: install the requested dependencies and shadcn primitives, configure Prisma 7 with SQLite and an initial migration, add the shared database/health/validation/type modules, create deterministic idempotent seed data, and pass all required build, lint, test, and seed gates without editing files owned by other tasks beyond the allowed shadcn CSS exception.

## Checklist

- [x] Install runtime/dev dependencies and initialize the requested shadcn components.
- [x] Define the Prisma schema, SQLite configuration, and initial migration.
- [x] Implement `lib/db.ts`, `lib/health.ts`, `lib/validation.ts`, and `lib/types.ts`.
- [x] Add comprehensive health unit tests and Vitest configuration.
- [x] Implement deterministic, idempotent seed data for people, projects, members, and milestones.
- [x] Run `npm run build`, `npm run lint`, `npm run test`, and `npm run seed` twice; resolve failures.
- [x] Audit the final diff against T1 ownership and prepare the completion report.

## Decisions

- Use the explicit T1 task dependency-install instruction as authorization to add packages; the contract's preinstalled-dependency warning applies to the other task owners who cannot edit `package.json`.
- Keep all source changes within the paths assigned to T1, with only shadcn's permitted token changes in `app/globals.css`.
- Normalize generated seed dates to UTC midnight and derive them from a fixed reference date so repeated runs are deterministic.

## Current state

T1 is complete. All required gates passed in order, the seed passed twice with identical counts, database constraints/settings were verified directly, and the final diff stays within T1 ownership plus the documented shadcn and project-process files.

## Next steps

None. Hand off the passing T1 foundation to the remaining task owners.

## Blockers

None.
