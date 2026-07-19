# PaaS deployment decision — Vercel vs Railway vs Render

Decision doc for hosting choice. No VPS. Preference order per stakeholder: (1) Vercel if
possible, (2) Railway or Render for anything needing a backend/database.

## 1. Comparison

| | Vercel-only | Railway | Render |
|---|---|---|---|
| Runs existing Docker image unchanged | No — serverless functions, no persistent disk, no long-running container | Yes | Yes |
| Persistent SQLite (`file:/data/prod.db`, WAL) | No — filesystem is read-only/ephemeral per invocation | Yes — attach a volume at `/data` | Yes — attach a persistent disk at `/data` |
| Cost ballpark (hobby/starter) | Free hobby tier for the app itself, but add $0 (Turso free tier) or ~$19/mo (Neon launch) once DB is migrated off SQLite | ~$5/mo starter (usage-based, includes small volume); verify in dashboard | $7/mo starter web service + ~$0.25/GB-mo for the 1GB disk (~$7-8/mo total); verify in dashboard |
| Custom domain + HTTPS | Yes, built-in, free | Yes, built-in, free (verify current TLS automation in dashboard) | Yes, built-in, free |
| Backup story | Depends entirely on the migrated DB provider (Turso/Neon both offer point-in-time restore) | No built-in DB backup for a volume — must script it (see §4) | No built-in DB backup for a disk — must script it (see §4); Render disks do support manual/scheduled snapshots per current docs, verify in dashboard |

## 2. Why Vercel-only fails today

Vercel functions are stateless and serverless: no writable persistent filesystem, no
long-running process. This app's data layer is `better-sqlite3` reading/writing a WAL-mode file
at `DATABASE_URL=file:/data/prod.db`, with `deploy/docker-entrypoint.sh` running
`prisma migrate deploy` against that file at container start. None of that has anywhere to live
on Vercel — every invocation gets a fresh, read-only-except-`/tmp` environment, and `/tmp` is
wiped between invocations and not shared across function instances.

**What a Vercel migration would take:**

1. Swap the Prisma datasource off `better-sqlite3`/SQLite to a network database:
   - **Turso (libSQL)** — closest to SQLite semantics (same SQL dialect, embedded-replica option),
     smallest conceptual diff. Requires `@prisma/adapter-libsql` (or `@libsql/client`), a new
     Turso database + auth token, and re-pointing `lib/db.ts`'s adapter construction.
   - **Neon (Postgres)** — bigger diff: `prisma/schema.prisma` datasource provider changes from
     `sqlite` to `postgresql`, the string-enum columns (`category`, `status`, `priority`) can move
     to native Postgres enums or stay as strings, and any SQLite-specific SQL (if present) needs
     review. More mature backup/PITR tooling than Turso.
2. Regenerate Prisma migrations for the new provider — SQLite and Postgres migration SQL are not
   interchangeable, so this is a fresh `prisma migrate dev` history, not a port of the existing
   `prisma/migrations/*`.
3. One-time data migration: export current SQLite rows, transform, load into the new DB. Dataset
   is small (pilot-scale per `deploy/README.md`), so this is a short script, not a pipeline.
4. Drop `better-sqlite3`, `@prisma/adapter-better-sqlite3`, the Alpine `libstdc++`/build-toolchain
   Dockerfile steps, and WAL-specific assumptions entirely — none of it applies to a network DB.
   The entrypoint's `prisma migrate deploy` step stays, but the `/data` writable-volume check in
   `deploy/docker-entrypoint.sh` goes away since there's no local file to guard.
5. Move `SESSION_SECRET` (and the new DB connection string) into Vercel's env var UI.

**Effort estimate:** Turso path ~4-8 hours (adapter swap, migration regen, data copy, test).
Neon/Postgres path ~8-14 hours (schema/enum rework, migration regen, data copy, test). Both
estimates assume the pilot dataset stays small and no other app code depends on SQLite-specific
behavior beyond `lib/db.ts`. Not done as part of this task — flagged as a future option only.

## 3. Recommendation: Render, single web service + persistent disk

**Render over Railway** for this app: Render's disk pricing and health-check/blueprint config
(`render.yaml`, committed at repo root) are predictable and file-based (reviewable in git),
whereas Railway's volume/env attachment is CLI/dashboard-only with no equivalent
config-as-code for the volume (see comments in `railway.toml`, also committed as a fallback).
Either platform runs the existing Docker image with zero app-code changes — this is the
deciding factor over any Vercel path today. If Render's disk pricing or availability turns out
worse than expected during setup, `railway.toml` is ready as a same-effort fallback.

### First-deploy steps (Render)

1. Install the CLI and log in (or just use the dashboard — Render's CLI is optional for
   deploys; blueprint sync works from the dashboard too):
   ```bash
   # optional CLI, verify current install command in dashboard docs
   curl -fsSL https://render.com/install.sh | sh
   render login
   ```
2. In the Render dashboard: **New > Blueprint**, point it at this repo. Render reads
   `render.yaml` at the repo root and provisions the web service + 1GB disk at `/data`
   automatically (verify blueprint auto-detection in dashboard — if it doesn't pick it up,
   create the service manually with type "Web Service", environment "Docker", and add the disk
   under the service's Disks tab with mount path `/data`, size 1GB).
3. Generate and set `SESSION_SECRET` (marked `sync: false` in `render.yaml`, so it must be set
   manually in the dashboard under the service's Environment tab):
   ```bash
   openssl rand -hex 32
   ```
   Paste the output as `SESSION_SECRET`. `DATABASE_URL=file:/data/prod.db` is already set via
   `render.yaml`.
4. Deploy. Render builds from `Dockerfile` and runs `deploy/docker-entrypoint.sh`, which applies
   `prisma migrate deploy` against `/data/prod.db` before starting `server.js`. Watch the build
   and deploy logs in the dashboard for the migration step.
5. Verify:
   ```bash
   curl --fail --show-error --head "https://<your-service>.onrender.com/login"
   ```
6. Seed personas — **only if the pilot wants the six personas + synthetic staff + load-test
   projects**, and only after the `SEED_DESTRUCTIVE=1` guard lands (parallel task; the seed
   currently replaces ALL data unconditionally, so do not run it against a database with real
   pilot entries until that guard exists):
   ```bash
   # via Render dashboard Shell tab on the service, once SEED_DESTRUCTIVE guard exists:
   SEED_DESTRUCTIVE=1 npx tsx prisma/seed.ts
   ```
   An empty pilot database (no seed run) is the default and recommended first-deploy state,
   matching the existing VPS runbook's production seed guidance in `deploy/README.md`.
7. Custom domain: dashboard **Settings > Custom Domains**, add the domain, then point its DNS
   `CNAME` (or `A`/`ALIAS` for an apex domain — verify current Render-recommended record type in
   dashboard) at the value Render shows. Render issues and renews the TLS certificate
   automatically once DNS resolves — verify current automatic-HTTPS behavior in dashboard.

## 4. Backup story (Render)

Render's persistent disks are not itself continuously replicated/backed up the way a managed DB
is (verify current disk-snapshot capability in dashboard — Render has historically offered
manual disk snapshots for some plans, but treat that as unconfirmed until checked). Don't rely
on the platform alone. Concrete plan, reusing the same `sqlite3 .backup` approach already proven
in `deploy/backup.sh` for the VPS path:

1. Add a scheduled **Render Cron Job** (a separate resource in the Render dashboard, same repo,
   same Docker image) that mounts the *same* `/data` disk read-only or shares it via a Render
   "Disk" attached to both services (verify current multi-service disk-sharing support in
   dashboard — if Render disks are single-service-only, run the backup from inside the web
   service itself via Render's **Jobs** feature instead, which executes in the service's own
   environment with access to its disk).
2. Cron job command, adapted from `deploy/backup.sh`'s existing `.backup`/integrity-check/retain
   logic:
   ```bash
   sqlite3 /data/prod.db ".backup '/data/backups/prod-$(date +%F).db'"
   sqlite3 "/data/backups/prod-$(date +%F).db" "PRAGMA integrity_check;"
   ```
   then ship that dated file off-disk with `rclone copyto` to an off-platform target (S3-
   compatible bucket, Backblaze B2, etc.) — same `RCLONE_TARGET` pattern `deploy/backup.sh`
   already uses, so the script is reusable as-is with `DB_PATH=/data/prod.db` and
   `BACKUP_DIR=/data/backups`.
3. Schedule nightly (e.g. `15 2 * * *`) via the Cron Job's schedule field in the dashboard.
4. Rehearse restore the same way `deploy/restore.md` already documents for the VPS: pull the
   latest off-box backup, run `PRAGMA integrity_check`, restore into a fresh `/data/prod.db`,
   confirm project count, log in successfully. Do this before calling the deploy launch-ready,
   consistent with the existing VPS runbook's restore-rehearsal requirement.

Off-platform copy is required either way — a disk backup that lives on the same platform/region
as the primary doesn't protect against a platform-level incident.
