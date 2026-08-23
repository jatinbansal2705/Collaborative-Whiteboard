#!/bin/sh
set -e

# Optional schema migration before boot. Enabled per environment via
# RUN_MIGRATIONS=true (used by the `migrate` service in docker-compose.prod.yml
# and by the deploy pipeline's migration job).
if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
  echo "Running prisma migrate deploy..."
  npx prisma migrate deploy
fi

exec node dist/main.js
