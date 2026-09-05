#!/usr/bin/env bash
# Push Doppler secrets to both Workers in one go.
# Usage: infra/scripts/push-secrets.sh <production|staging>
set -euo pipefail

env_name="${1:?usage: push-secrets.sh <production|staging>}"
case "$env_name" in
  production) cfg=prd ;;
  staging) cfg=stg ;;
  *) echo "unknown env $env_name" >&2; exit 1 ;;
esac

root="$(cd "$(dirname "$0")/../.." && pwd)"
all="$(doppler secrets download --no-file --format json --project sendtally --config "$cfg")"

pick() { jq -c --argjson keys "$1" 'with_entries(select(.key as $k | $keys | index($k)))' <<<"$all"; }

(cd "$root/packages/sync-service" && pick '["TOKEN_KEY","CLERK_SECRET_KEY","STRAVA_CLIENT_ID","STRAVA_CLIENT_SECRET","STRAVA_WEBHOOK_VERIFY_TOKEN"]' | npx wrangler secret bulk --env "$env_name")
(cd "$root/apps/web" && pick '["CLERK_SECRET_KEY"]' | npx wrangler secret bulk --env "$env_name")
