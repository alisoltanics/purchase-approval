#!/usr/bin/env bash
# Writes a compressed pg_dump of the staging database to deploy/backups/. Never removes data.
source "$(dirname "$0")/lib.sh"
mkdir -p deploy/backups
out="deploy/backups/$(date -u +%Y%m%dT%H%M%SZ).sql.gz"
umask 077
dc exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner' | gzip > "$out"
[ -s "$out" ] || { echo "backup is empty" >&2; rm -f "$out"; exit 1; }
echo "Backup written: $out"
