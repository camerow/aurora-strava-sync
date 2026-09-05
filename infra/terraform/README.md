# sendtally infrastructure

Terraform owns the account-level Cloudflare resources for sendtally in the
**Chalk and Circuits** account (`f3514650e9f74f7fe7db71fdd6577a8f`):

- the `sendtally.com` zone and its TLS/HTTPS settings
- DNS records that are not Worker hostnames (Clerk, mail, verification)
- D1 databases (`sendtally-staging`, `sendtally-production`)
- Queues (`sendtally-sync-staging`, `sendtally-sync-production`)

Wrangler still owns what it deploys: the Worker scripts, their bindings, cron
triggers, queue consumers, Worker secrets, and the Worker custom domains
(`sendtally.com`, `api.sendtally.com`, `staging.*`, `api-staging.*`). Those are
created on `wrangler deploy` and need the script to exist first, so they stay in
`wrangler.jsonc`. Terraform outputs the D1 ids that `wrangler.jsonc` pins.

## Setup

```sh
brew install hashicorp/tap/terraform     # >= 1.9
cd infra/terraform
terraform init
cp terraform.tfvars.example terraform.tfvars
export TF_VAR_cloudflare_api_token=...   # from 1Password, vault "Send Tally"
terraform plan
```

State is local and gitignored. There is one operator; if that changes, move
state to an R2 bucket with the `s3` backend before a second person runs
`apply`.

### API token

Create at dash.cloudflare.com/profile/api-tokens ("Create Custom Token"):

| Scope   | Permission                                   |
| ------- | -------------------------------------------- |
| Account | Account Settings: Read                        |
| Account | Workers Scripts: Edit                        |
| Account | D1: Edit                                     |
| Account | Queues: Edit                                 |
| Zone    | Zone: Edit                                   |
| Zone    | Zone Settings: Edit                          |
| Zone    | DNS: Edit                                    |
| Zone    | SSL and Certificates: Edit                   |
| Zone    | Workers Routes: Edit                         |

Account resources: **Chalk and Circuits** only. Zone resources: all zones in
that account. Store it in 1Password; never in tfvars or the repo.

## Day-to-day

- New DNS record: add to `dns_records` in `terraform.tfvars`, `terraform apply`.
- New D1/queue environment: extend `local.environments` in `d1.tf`, apply,
  then paste the id from `terraform output d1_database_ids` into `wrangler.jsonc`.
- D1 schema changes stay in Drizzle + `wrangler d1 migrations apply`; Terraform
  never touches table contents.
- `prevent_destroy` is on for D1. Removing an environment needs a deliberate
  two-step (drop the lifecycle block, apply).

The migration from the personal account is documented in
`docs/cloudflare-account-migration.md`.
