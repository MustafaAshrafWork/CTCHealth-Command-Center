#!/bin/sh
set -eu

umask 027

if [ ! -d /data ] || [ ! -w /data ]; then
  echo "ERROR: /data must exist and be writable by UID/GID 1001." >&2
  exit 1
fi

npx prisma migrate deploy

exec "$@"
