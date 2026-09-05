# Moving sendtally to the Chalk and Circuits Cloudflare account

Status: in progress (started 2026-09-05). Steps marked `[ ]` are pending.

Source account: `Cameron.will@gmail.com's Account` (`7b398a51337874fb6b7ceb188e5961e9`).
Destination: `Chalk and Circuits` (`f3514650e9f74f7fe7db71fdd6577a8f`).

What lives in the source account today:

| Resource                                   | Note                                                                   |
| ------------------------------------------ | ---------------------------------------------------------------------- |
| Zone `sendtally.com`                       | Cloudflare Registrar domain, registered 2026-08-06, expires 2027-08-06 |
| Worker `sendtally-sync-service-production` | custom domain `api.sendtally.com`, 5 secrets, hourly + 04:00 crons     |
| Worker `sendtally-web-production`          | custom domain `sendtally.com`, 1 secret                                |
| D1 `sendtally-production`                  | ~43 MB. The `sendtally-staging` id in wrangler.jsonc never existed     |
| Queue `sendtally-sync-production`          |                                                                        |

The destination already has an empty queue `sendtally-sync-production`
(created 2026-09-03) that Terraform imports rather than recreates.

## Order of operations

The hostnames do not change, so Strava OAuth callbacks, the Strava webhook
subscription, Clerk's production instance, and the mobile app config all
survive untouched. The only external-facing change is the zone's name servers.

The one hazard is **double posting**: both accounts' Workers share nothing, so
if both crons run against a copy of the same data they both post the same
session to Strava. The old cron must be off before the new one is on.

### 1. API token `[ ]`

Create the token described in `infra/terraform/README.md`, plus a second,
short-lived token on the **source** account with Zone: DNS Read and Zone:
Read, for exporting the current records. Both go in 1Password.

### 2. Export DNS from the old zone `[ ]`

```sh
curl -s -H "Authorization: Bearer $OLD_TOKEN" \
  "https://api.cloudflare.com/client/v4/zones/a62e059b27491363f3065ba6c7784df4/dns_records/export"
```

Drop the Worker hostnames (`sendtally.com`, `api.sendtally.com`, and any
`staging`/`api-staging` entries): wrangler recreates those as custom domains.
Everything else (Clerk `clerk`, `accounts`, `clkmail`, `clk._domainkey`,
`clk2._domainkey`; any verification TXTs) goes into `dns_records` in
`infra/terraform/terraform.tfvars`. Also check the old zone for DNSSEC (must be
off before the Registrar move) and for any page rules or redirect rules.

### 3. Provision the destination `[ ]`

```sh
cd infra/terraform
terraform init
terraform import 'cloudflare_queue.sync["production"]' f3514650e9f74f7fe7db71fdd6577a8f/378974a189b74631b7b825cee0a959b2
terraform apply
terraform output d1_database_ids
```

The zone is created in `pending` state; that is expected until step 7. Paste
the two D1 ids into the `staging` and `production` blocks of
`packages/sync-service/wrangler.jsonc` (the account pin there and in
`apps/web/wrangler.jsonc` already points at Chalk and Circuits).

### 4. Deploy the Workers and their secrets `[ ]`

```sh
infra/scripts/push-secrets.sh production
pnpm --filter @sendtally/sync-service exec wrangler d1 migrations apply DB --env production --remote
pnpm --filter @sendtally/sync-service exec wrangler deploy --env production
CLOUDFLARE_ENV=production pnpm --filter @sendtally/web build
pnpm --filter @sendtally/web exec wrangler deploy --env production
```

Wrangler attaches the custom domains to the pending zone; they go live when
the zone does. Until then the new Workers are reachable only on their
`workers.dev` URLs, which is enough to hit `/health`.

### 5. Freeze the old service and copy the data `[ ]`

Stop the old cron so no further sessions post from the old account. The
cleanest switch is to delete its triggers in the dashboard
(Workers → sendtally-sync-service-production → Settings → Triggers), leaving
the HTTP route up so the site stays live.

Then copy the database:

```sh
infra/scripts/copy-d1.sh production
```

The script exports from the old account and imports into the new one, then
prints per-table row counts. Compare them with the old database before moving
on. Anything a user does on the old site between this copy and step 7
(connecting a board, a new sync) is lost; keep the window short.

### 6. Repoint CI `[ ]`

In `camerow/sendtally` GitHub secrets, set `CLOUDFLARE_ACCOUNT_ID` to
`f3514650e9f74f7fe7db71fdd6577a8f` and `CLOUDFLARE_API_TOKEN` to the new
account's token. Merge the migration PR; the deploy workflow now targets the
new account.

### 7. Move the domain registration `[ ]`

In the **source** account: Domain Registration → Manage Domains →
sendtally.com → Configuration → "Move to another account", destination account
id `f3514650e9f74f7fe7db71fdd6577a8f`. Then in the destination account accept
under Manage Domains → View Actions (five-day window).

The move reassigns the registration's name servers to the new zone's pair
(`terraform output name_servers`), which flips the new zone to `active` and
brings the Worker custom domains up. Expect a few minutes to an hour of
inconsistent resolution while resolvers pick up the new NS. The registration
is transfer-locked for 30 days afterwards, which is fine.

Verify:

```sh
dig +short NS sendtally.com
curl -s https://api.sendtally.com/health
curl -sI https://sendtally.com | head -1
```

Sign in on the web app and in the mobile app; trigger a manual sync.

### 8. Turn the new cron on, decommission the old account `[ ]`

The new Worker's cron was live from step 4 but had no users until step 5's
copy; confirm the first hourly run in `wrangler tail --env production`.

Then, in the old account, delete both Workers, the D1 database, the queue, and
finally the (now `moved`) zone. Revoke the old export token.

## Rollback

Before step 7 nothing user-facing has changed; restore the old cron triggers
and stop. After step 7, moving the registration back is another five-day-window
support flow, so verify thoroughly at step 7 before touching the old account.
