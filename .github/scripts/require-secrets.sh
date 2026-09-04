#!/usr/bin/env bash
# Fail the deploy when a Worker is missing a secret it needs at runtime.
# A Worker recreated in the dashboard loses every secret, and `wrangler deploy`
# still succeeds - the Worker then throws on every request.
set -euo pipefail

env_name="$1"
shift

# Skip any banner wrangler prints before the JSON array.
present="$(npx wrangler secret list --env "$env_name" --format json | sed -n '/^\[/,$p' | jq -r '.[].name')"

missing=()
for name in "$@"; do
  grep -qx "$name" <<<"$present" || missing+=("$name")
done

if [ ${#missing[@]} -gt 0 ]; then
  echo "::error::Missing Worker secrets for --env ${env_name}: ${missing[*]}"
  echo "Set them from the Doppler project before deploying (see AGENTS.md 'Secrets')."
  exit 1
fi

echo "All required secrets present for --env ${env_name}: $*"
