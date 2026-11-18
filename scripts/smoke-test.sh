#!/usr/bin/env bash
set -euo pipefail

# Post-deploy smoke test against the public Kyma host. This is the GitHub Actions
# equivalent of FIPC's Jenkinsfile checkHealth() helper.
#
# Usage: smoke-test.sh <host> [max-attempts] [sleep-seconds]

HOST="${1:?usage: smoke-test.sh <host> [max-attempts] [sleep-seconds]}"
MAX_ATTEMPTS="${2:-30}"
SLEEP_SECONDS="${3:-10}"

BODY_FILE="$(mktemp)"
trap 'rm -f "$BODY_FILE"' EXIT

for i in $(seq 1 "$MAX_ATTEMPTS"); do
  code="$(curl -s -o "$BODY_FILE" -w '%{http_code}' "https://${HOST}/healthz" || true)"
  echo "Attempt ${i}: GET https://${HOST}/healthz -> ${code}"
  if [[ "$code" == "200" ]]; then
    body="$(cat "$BODY_FILE")"
    if [[ "$body" != "OK" ]]; then
      echo "Unexpected /healthz body: '${body}' (expected 'OK')" >&2
      exit 1
    fi
    # Checks the greeting only, not the field names, so it also passes against the
    # previous version after a rollback. The e2e checks the response format.
    greeting="$(curl -s "https://${HOST}/greeting")"
    if [[ "$greeting" != *'Hello World'* ]]; then
      echo "Unexpected /greeting body: '${greeting}' (expected 'Hello World')" >&2
      exit 1
    fi
    echo "Smoke test passed against https://${HOST}"
    exit 0
  fi
  sleep "$SLEEP_SECONDS"
done

echo "Smoke test failed: https://${HOST}/healthz never returned 200." >&2
exit 1
