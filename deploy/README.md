# VPS deployment runbook

This deployment runs the generic Next.js application image behind Caddy automatic HTTPS. SQLite data lives in a host bind mount and therefore survives image rebuilds and container replacement. Run all commands from the deployment checkout.

## Prerequisites

- A Linux VPS with Docker Engine and the Docker Compose plugin.
- A domain or subdomain whose public `A` record points to the VPS. Add an `AAAA` record only when IPv6 is configured on the VPS.
- Inbound TCP ports 80 and 443, plus UDP 443, allowed by the VPS firewall/provider firewall.
- `sqlite3` and cron installed on the host for backups and restore checks.
- Either `rclone` with a tested remote or `scp` with key-based authentication for off-box copies.
- A deployment directory such as `/opt/ctchealth-command-center` containing this repository checkout.

Do not continue until `dig +short YOUR_DOMAIN` resolves to the VPS public address. Caddy obtains and renews its certificate after ports 80/443 are reachable.

## Production environment

Create `.env.production` on the VPS. It is ignored by Git and must never be committed:

```dotenv
DOMAIN=command.example.com
SESSION_SECRET=replace-with-generated-value
```

Use a bare hostname for `DOMAIN`, without `https://` or a path. Generate the session secret on the VPS:

```bash
openssl rand -hex 32
```

Paste the output as `SESSION_SECRET` and protect the file:

```bash
chmod 600 .env.production
```

Keep the same `SESSION_SECRET` across redeploys. Rotating it signs out every current session.

## First deploy

Prepare the data bind mount for the image's non-root UID/GID 1001. Keep host backups root-only because the root cron job will write them:

```bash
sudo install -d -m 0770 -o 1001 -g 1001 data
sudo install -d -m 0700 -o root -g root backups
```

Validate the resolved Compose configuration locally on the VPS. Its output contains the resolved session secret, so do not paste or save it:

```bash
docker compose --env-file .env.production config --quiet
```

Build and start the full stack with one command:

```bash
docker compose --env-file .env.production up -d --build
```

The app entrypoint applies committed Prisma migrations to `/data/prod.db` before starting `server.js`. Check startup and HTTPS:

```bash
docker compose --env-file .env.production ps
docker compose --env-file .env.production logs --tail=100 app caddy
curl --fail --show-error --head "https://$(sed -n 's/^DOMAIN=//p' .env.production)/login"
```

### Production seed choice

An empty pilot database is supported and is the default: do not run a seed command after the first deploy.

If the pilot explicitly wants the six real staff personas and 65 load-test projects, run the seed manually only while the database has no projects:

```bash
docker compose --env-file .env.production exec app npx tsx prisma/seed.ts
```

The staff-persona upserts are non-destructive. If any project already exists, the seed provisions those personas and then aborts without changing project data. To intentionally delete and replace every project, milestone, and membership with the load-test dataset, use the explicit destructive override:

```bash
docker compose --env-file .env.production exec -e SEED_DESTRUCTIVE=1 app npx tsx prisma/seed.ts
```

Never use `SEED_DESTRUCTIVE=1` after real pilot entry has started unless destroying that project data is explicitly intended.

## Redeploy

Place the new checkout/artifacts in this directory, then rebuild and replace containers. The bind-mounted `./data` directory and named Caddy volumes are not replaced:

```bash
docker compose --env-file .env.production up -d --build --remove-orphans
docker compose --env-file .env.production ps
docker compose --env-file .env.production logs --tail=100 app caddy
```

The startup migration is repeatable. Never run `docker compose down -v`; `-v` deletes Caddy's named data, including certificate state. Never delete `./data` during a redeploy.

## Nightly off-box backup

`deploy/backup.sh` uses the SQLite CLI `.backup` API, validates the result, retains 14 local daily files, and then uses a configured off-box target. It does not copy a live WAL database with `cp`. Run it as root (or a dedicated backup account that can read UID/GID 1001 files); the examples below use root cron.

Configure and test the off-box credentials as root so cron uses the same credential store. For rclone, run `sudo rclone config` first, then test:

```bash
sudo env DB_PATH="$PWD/data/prod.db" BACKUP_DIR="$PWD/backups" RCLONE_TARGET="remote:ctchealth-command-center" ./deploy/backup.sh
```

Or configure root's SSH key for an off-box account and use an existing destination directory:

```bash
sudo env DB_PATH="$PWD/data/prod.db" BACKUP_DIR="$PWD/backups" SCP_TARGET="backup-user@backup-host:/srv/ctchealth/" ./deploy/backup.sh
```

After the interactive test succeeds, add a nightly 02:15 job with `sudo crontab -e`. Use absolute paths and choose one off-box method:

```cron
15 2 * * * cd /opt/ctchealth-command-center && DB_PATH=/opt/ctchealth-command-center/data/prod.db BACKUP_DIR=/opt/ctchealth-command-center/backups RCLONE_TARGET=remote:ctchealth-command-center ./deploy/backup.sh >> /opt/ctchealth-command-center/backups/backup.log 2>&1
```

Verify the next run locally and off-box:

```bash
latest_backup="$(sudo find backups -maxdepth 1 -name 'prod-????-??-??.db' -type f | sort | tail -1)"
test -n "$latest_backup"
sudo sqlite3 "$latest_backup" "PRAGMA integrity_check;"
sudo rclone lsl remote:ctchealth-command-center
```

The integrity check must print `ok`, and the same dated filename must appear at the off-box target. Alerting for a failed cron job must be configured at the VPS/operations layer.

## Restore rehearsal

Follow [restore.md](./restore.md) exactly. A deployment is not launch-ready until an operator has restored a backup, verified its project count, and logged in successfully. Record the rehearsal date, backup checksum, expected/actual project counts, and operator in the operations log.

## Azure/PostgreSQL migration path

The application boundary stays generic: runtime configuration supplies `DATABASE_URL`, and the app listens on port 3000 without depending on Caddy. For the planned Azure move:

1. Change the Prisma datasource/adapter to PostgreSQL, create and test PostgreSQL migrations, rebuild the same Dockerfile, and run a validated one-time SQLite-to-PostgreSQL data copy for the small dataset.
2. Point `DATABASE_URL` at Azure Database for PostgreSQL and store it together with `SESSION_SECRET` in Azure Key Vault; do not bake either value into the image.
3. Deploy the same application-container pattern to Azure Container Apps or App Service, replace Caddy with Azure ingress, and remove the SQLite bind mount.
4. Validate row counts, relationships, login attribution, optimistic locking, and backup/restore before cutover.

Caddy, the Compose file, and the SQLite backup job are VPS infrastructure only. Application routes and UI do not need to change for the hosting move.
