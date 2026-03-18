#!/bin/sh
set -e
pg_ctl -D /var/lib/postgresql/data init -o "--auth=trust" 2>/dev/null || true
pg_ctl -D /var/lib/postgresql/data -l /tmp/pg.log start -w
exec "$@"
