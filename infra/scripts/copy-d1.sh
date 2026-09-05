#!/usr/bin/env bash
# Copy a D1 database from the old personal account into the Chalk and Circuits account.
# Usage: infra/scripts/copy-d1.sh <env>   (env = production | staging)
# Requires a wrangler login that can see both accounts. Runs from a scratch dir so the
# repo's pinned account_id does not apply.
set -euo pipefail

env_name="${1:?usage: copy-d1.sh <production|staging>}"
old_account="7b398a51337874fb6b7ceb188e5961e9"
new_account="f3514650e9f74f7fe7db71fdd6577a8f"
db="sendtally-${env_name}"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

cd "$work"
echo "Exporting ${db} from ${old_account}..."
CLOUDFLARE_ACCOUNT_ID="$old_account" npx wrangler d1 export "$db" --remote --output ./dump.sql
echo "Importing into ${db} in ${new_account}..."
CLOUDFLARE_ACCOUNT_ID="$new_account" npx wrangler d1 execute "$db" --remote --yes --file ./dump.sql
echo "Row counts in the new database:"
CLOUDFLARE_ACCOUNT_ID="$new_account" npx wrangler d1 execute "$db" --remote --json \
  --command "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != 'd1_migrations'" \
  | jq -r '.[0].results[].name' \
  | while read -r t; do
      printf '%-28s ' "$t"
      CLOUDFLARE_ACCOUNT_ID="$new_account" npx wrangler d1 execute "$db" --remote --json --command "SELECT COUNT(*) AS n FROM \"$t\"" | jq -r '.[0].results[0].n'
    done
