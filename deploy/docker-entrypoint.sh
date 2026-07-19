#!/bin/sh
set -eu

umask 027

# PaaS volumes (Railway) mount root-owned; take ownership once, then drop to
# the unprivileged runtime user for migrations and the server alike.
if [ "$(id -u)" = "0" ]; then
  mkdir -p /data
  chown nextjs:nodejs /data
  exec su-exec nextjs:nodejs "$0" "$@"
fi

if [ ! -d /data ] || [ ! -w /data ]; then
  echo "ERROR: /data must exist and be writable by UID/GID 1001." >&2
  exit 1
fi

npx prisma migrate deploy

exec "$@"
