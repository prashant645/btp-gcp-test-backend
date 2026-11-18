#!/usr/bin/env bash
# Runs the e2e Postman collection with Newman against a deployed environment.
# Follows the FIPC runTest.sh contract: -e <env>, JUnit results, exit 99 on test failure.
#
# Besides this backend's own API, it checks the frontend that calls it: the frontend's
# /api/greeting must return this backend's version. So a backend change that breaks the
# frontend fails here, and the backend rolls itself back.
#
# Usage: runTest.sh -e <dev|qa> -v <expected-version> [-u <base-url> -f <frontend-url>] [-o <results-dir>]
#
#   -e  environment; the host and frontend URL come from helm/demoapp-backend/values-<env>.yaml
#   -v  version /version must return (the deployed commit SHA)
#   -u  test this URL instead, e.g. a local server. Skips the gateway check.
#   -f  frontend URL (required with -u). Otherwise consumer.frontendUrl from the values file.
#   -o  results directory (default e2e/results)
#
# Exit: 0 passed, 99 tests failed, 98 the frontend is down (not this service's fault,
#       so the pipeline doesn't roll back), 1 usage or setup problem.
set -uo pipefail

NEWMAN_VERSION=6.2.3
ITERATIONS=5
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

usage() { echo "usage: $0 -e <dev|qa> -v <expected-version> [-u <base-url> -f <frontend-url>] [-o <results-dir>]" >&2; exit 1; }

env_name=""; expected=""; base_url=""; frontend_url=""; results="$ROOT/e2e/results"
while getopts "e:v:u:f:o:" opt; do
  case "$opt" in
    e) env_name="$OPTARG" ;;
    v) expected="$OPTARG" ;;
    u) base_url="$OPTARG" ;;
    f) frontend_url="$OPTARG" ;;
    o) results="$OPTARG" ;;
    *) usage ;;
  esac
done
[[ "$env_name" == dev || "$env_name" == qa ]] || usage
[[ -n "$expected" ]] || usage

check_gateway=false
if [[ -z "$base_url" ]]; then
  host="$(sed -n 's/^  host: *//p' "$ROOT/helm/demoapp-backend/values-$env_name.yaml")"
  if [[ -z "$host" ]]; then
    echo "No apirule host found in values-$env_name.yaml" >&2
    exit 1
  fi
  base_url="https://$host"
  check_gateway=true
  [[ -n "$frontend_url" ]] || frontend_url="$(sed -n 's/^  frontendUrl: *//p' "$ROOT/helm/demoapp-backend/values-$env_name.yaml")"
fi

if [[ -z "$frontend_url" ]]; then
  echo "No frontend URL: pass -f, or set consumer.frontendUrl in values-$env_name.yaml" >&2
  exit 1
fi

# The frontend must be healthy first. If it isn't, the failure isn't this service's,
# so don't run the tests; the pipeline skips the rollback on exit 98.
code="$(curl -s -m 10 -o /dev/null -w '%{http_code}' "$frontend_url/healthz" || true)"
if [[ "$code" != 200 ]]; then
  echo "Frontend is down: $frontend_url/healthz -> ${code:-no answer}. Not a backend problem, so no rollback." >&2
  exit 98
fi

command -v npx >/dev/null || { echo "npx not found; set up Node first" >&2; exit 1; }
npx --yes "newman@$NEWMAN_VERSION" --version >/dev/null || { echo "Could not install Newman" >&2; exit 1; }
mkdir -p "$results"

echo "e2e: $base_url ($env_name), expecting version $expected, frontend $frontend_url"
if npx --yes "newman@$NEWMAN_VERSION" run "$ROOT/e2e/backend.postman_collection.json" \
    --env-var "rootUrl=$base_url" \
    --env-var "expectedVersion=$expected" \
    --env-var "frontendUrl=$frontend_url" \
    --env-var "checkGateway=$check_gateway" \
    --iteration-count "$ITERATIONS" \
    --timeout-request 10000 \
    --color off \
    --reporters cli,junit \
    --reporter-junit-export "$results/e2e-$env_name.xml"; then
  echo "Test Execution ===> SUCCESS"
  exit 0
fi
echo "Test Execution ===> FAILED, see $results/e2e-$env_name.xml" >&2
exit 99
