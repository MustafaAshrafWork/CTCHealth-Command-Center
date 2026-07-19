# T10 deploy-artifacts implementation plan

## Goal

Produce and verify the VPS deployment artifacts for the ctcHealth Command Center MVP: a generic Next.js standalone container, startup migrations for bind-mounted SQLite, Docker Compose with Caddy automatic HTTPS, and documented nightly off-box backup and restore procedures. Deployment and Git commits remain out of scope until VPS credentials and a domain are available.

## Checklist

- [x] Read `AGENTS.md`, `CONTRACTS.md`, plan v2 sections 4 and 10, and the bundled Next.js 16.2.10 standalone documentation.
- [x] Add standalone output and a secret-safe Docker build context.
- [x] Add the multi-stage, non-root application image and migration entrypoint.
- [x] Add Docker Compose and Caddy configuration.
- [x] Add the SQLite backup script and exact restore procedure.
- [x] Add the deployment runbook, including optional production seeding and the Azure/Postgres migration note.
- [x] Verify `next build` against a nonexistent database path and avoid page changes unless the build proves they are required.
- [x] Run `npm run build`, `npm run lint`, and `npm run test`.
- [x] Run a real `docker build .` because Docker is available.
- [x] Review the final diff, update this handoff, and report all deviations without committing or deploying.

## Decisions

- Keep `DATABASE_URL` entirely runtime-configured; the build will be tested with a path that does not exist.
- Preserve all files owned by other tasks; only deployment artifacts and `next.config.ts` are in T10 scope.
- Run the application as UID/GID 1001 and document matching ownership for the host bind mount.
- Keep Caddy and SQLite outside the application contract so the same application image can later run behind Azure ingress with PostgreSQL.
- Run `prisma generate` explicitly in the build stage: Prisma 7 cannot generate the client in the dependency-only stage because that stage intentionally lacks the schema.
- Use a regular `RUN chmod` for the entrypoint instead of BuildKit-only `COPY --chmod`, preserving compatibility with the Docker legacy builder present on the validation host.

## Current state

T10 build work is complete. The npm gates, database-independent build check, Compose/shell checks, live SQLite backup smoke test, real Docker build, migration-on-start container smoke test, `/login` request, and optional 65-project seed smoke test all passed. No page required a `force-dynamic` change.

## Next steps

Once VPS credentials, DNS, and an off-box target exist, follow `deploy/README.md`, configure root's backup credentials and cron, then perform and record the restore rehearsal in `deploy/restore.md`.

## Blockers

- VPS credentials and the production domain are unavailable, so deployment, live HTTPS validation, cron installation, off-box target configuration, and a real restore rehearsal cannot be performed in T10.
