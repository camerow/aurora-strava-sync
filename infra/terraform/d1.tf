locals {
  environments = toset(["staging", "production"])
}

resource "cloudflare_d1_database" "sendtally" {
  for_each = local.environments

  account_id            = var.account_id
  name                  = "sendtally-${each.key}"
  primary_location_hint = "wnam"

  lifecycle {
    prevent_destroy = true
  }
}
