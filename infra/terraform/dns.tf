resource "cloudflare_dns_record" "sendtally" {
  for_each = var.dns_records

  zone_id  = cloudflare_zone.sendtally.id
  name     = each.value.name
  type     = each.value.type
  content  = each.value.content
  proxied  = each.value.proxied
  ttl      = each.value.ttl
  priority = each.value.priority
  comment  = each.value.comment
}
