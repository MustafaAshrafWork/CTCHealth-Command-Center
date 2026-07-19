# SQLite restore procedure

These steps restore a nightly backup into the bind-mounted production path. Run them from the deployment checkout. Replace the example backup filename and the expected count before starting.

1. Record the backup checksum and confirm its SQLite integrity:

   ```bash
   sudo sha256sum backups/prod-2026-07-19.db
   sudo sqlite3 backups/prod-2026-07-19.db "PRAGMA integrity_check;"
   ```

   Continue only when the integrity command prints `ok`.

2. Stop the application so no process can write to the live database. Caddy may remain running:

   ```bash
   docker compose --env-file .env.production stop app
   docker compose --env-file .env.production ps
   ```

3. Preserve the current database and its WAL sidecars in a root-only recovery directory outside the repository checkout:

   ```bash
   restore_stamp="$(date +%Y%m%d-%H%M%S)"
   restore_root="/var/backups/ctchealth-command-center/restore-safety"
   sudo install -d -m 0700 -o root -g root "$restore_root/$restore_stamp"
   for database_file in data/prod.db data/prod.db-wal data/prod.db-shm; do
     if [ -e "$database_file" ]; then
       sudo mv "$database_file" "$restore_root/$restore_stamp/"
     fi
   done
   ```

4. Copy the selected backup to the host bind mount, which is `/data/prod.db` inside the container, and restore ownership for the non-root application user:

   ```bash
   sudo install -m 0660 -o 1001 -g 1001 backups/prod-2026-07-19.db data/prod.db
   ```

5. Start the application. Its entrypoint runs `npx prisma migrate deploy` before the server starts:

   ```bash
   docker compose --env-file .env.production start app
   docker compose --env-file .env.production logs --tail=100 app
   ```

6. Verify the restored project count and database integrity:

   ```bash
   sudo sqlite3 data/prod.db "SELECT COUNT(*) AS project_count FROM Project;"
   sudo sqlite3 data/prod.db "PRAGMA integrity_check;"
   ```

   Compare the first result with the expected project count captured for the backup. The second command must print `ok`.

7. Open `https://YOUR_DOMAIN/login`, sign in as a pilot persona, and confirm the Projects list shows the restored count. Create and remove a clearly labeled restore-test project only if the rehearsal is authorized to change production data.

8. Keep `$restore_root/$restore_stamp` until the restored application has been accepted. Then remove it according to the operating team's retention policy; do not leave safety copies indefinitely on the VPS.

If startup or verification fails, stop `app`, move the failed `data/prod.db` aside, move the three preserved files back from `$restore_root/$restore_stamp`, restore UID/GID `1001:1001`, and start `app` again.
