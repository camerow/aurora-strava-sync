resource "cloudflare_queue" "sync" {
  for_each = local.environments

  account_id = var.account_id
  queue_name = "sendtally-sync-${each.key}"
}
