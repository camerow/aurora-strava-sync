resource "cloudflare_zone" "sendtally" {
  account = { id = var.account_id }
  name    = var.domain
  type    = "full"
}

locals {
  zone_settings = {
    ssl                      = "strict"
    always_use_https         = "on"
    automatic_https_rewrites = "on"
    min_tls_version          = "1.2"
    tls_1_3                  = "on"
    http3                    = "on"
    brotli                   = "on"
  }
}

resource "cloudflare_zone_setting" "sendtally" {
  for_each   = local.zone_settings
  zone_id    = cloudflare_zone.sendtally.id
  setting_id = each.key
  value      = each.value
}
