#!/usr/bin/env bash
#
# Health-check gate for deployments (and ad-hoc uptime verification).
# Retries until the endpoint answers 200 or the timeout elapses.
#
# Usage: health-check.sh <url> [timeout-seconds]
set -euo pipefail

URL="${1:?Usage: health-check.sh <url> [timeout-seconds]}"
TIMEOUT_SECONDS="${2:-180}"
INTERVAL_SECONDS=5

elapsed=0
while true; do
  status="$(curl -fsS -o /dev/null -w '%{http_code}' --max-time 10 "$URL" || true)"
  if [ "$status" = "200" ]; then
    echo "Health check passed: ${URL} -> 200"
    exit 0
  fi
  if [ "$elapsed" -ge "$TIMEOUT_SECONDS" ]; then
    echo "Health check FAILED after ${TIMEOUT_SECONDS}s: ${URL} (last status: ${status:-none})" >&2
    exit 1
  fi
  echo "Waiting for ${URL}... (status: ${status:-none}, ${elapsed}s/${TIMEOUT_SECONDS}s)"
  sleep "$INTERVAL_SECONDS"
  elapsed=$((elapsed + INTERVAL_SECONDS))
done
