#!/usr/bin/env bash
# Verify a just-deployed URL actually serves 2xx. A wrangler deploy reports
# success for a Worker that throws on every request, so the deploy is only
# green once the deployed code answers.
set -euo pipefail

url="$1"
attempts="${2:-6}"
body="$(mktemp)"
trap 'rm -f "$body"' EXIT

status=000
for attempt in $(seq 1 "$attempts"); do
  status="$(curl -sS -o "$body" -w '%{http_code}' --max-time 20 "$url" || true)"
  [[ "$status" =~ ^[0-9]{3}$ ]] || status=000
  if [ "$status" -ge 200 ] && [ "$status" -lt 300 ]; then
    echo "OK ${status} ${url}"
    exit 0
  fi
  echo "attempt ${attempt}/${attempts}: ${url} returned ${status}"
  sleep $((attempt * 5))
done

echo "::error::${url} never returned 2xx (last status ${status})"
head -c 2000 "$body"
exit 1
