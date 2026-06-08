output "vm_ip" {
  description = "Public IPv4 address of the tasks VM"
  value       = google_compute_address.vm.address
}

output "vm_name" {
  description = "GCE instance name"
  value       = google_compute_instance.vm.name
}

output "domain" {
  description = "Effective public hostname Caddy will serve"
  value       = local.effective_domain
}

output "ssh_command" {
  description = "Convenience SSH command for humans"
  value       = "ssh ${var.ssh_user}@${google_compute_address.vm.address}"
}

output "url" {
  description = "Public URL the app is served on"
  value       = "https://${local.effective_domain}"
}
