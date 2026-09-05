output "zone_id" {
  value = cloudflare_zone.sendtally.id
}

output "zone_status" {
  description = "Becomes 'active' once the Registrar move lands and the zone's name servers are live."
  value       = cloudflare_zone.sendtally.status
}

output "name_servers" {
  value = cloudflare_zone.sendtally.name_servers
}

output "d1_database_ids" {
  description = "Paste into the matching env block of packages/sync-service/wrangler.jsonc."
  value       = { for env, db in cloudflare_d1_database.sendtally : env => db.id }
}

output "queue_ids" {
  value = { for env, q in cloudflare_queue.sync : env => q.id }
}
