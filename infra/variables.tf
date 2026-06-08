variable "project_id" {
  description = "GCP project id (bootstrap script reuses existing 'formulai' project)"
  type        = string
  default     = "formulai"
}

variable "region" {
  description = "GCP region for the VM and persistent disk"
  type        = string
  default     = "europe-west1"
}

variable "zone" {
  description = "GCP zone (must be inside var.region)"
  type        = string
  default     = "europe-west1-b"
}

variable "name_prefix" {
  description = "Prepended to every resource we create -- keeps us namespaced inside the shared 'formulai' project"
  type        = string
  default     = "tasks"
}

variable "machine_type" {
  description = "GCE machine type. e2-small = 2 vCPU shared + 2 GB RAM"
  type        = string
  default     = "e2-small"
}

variable "boot_disk_image" {
  description = "Boot image family. Debian 12 has docker.io + compose plugin in apt"
  type        = string
  default     = "debian-cloud/debian-12"
}

variable "boot_disk_size_gb" {
  description = "Boot disk size. 20 GB leaves room for images, db, backups"
  type        = number
  default     = 20
}

variable "allowed_ssh_cidr" {
  description = "CIDR range allowed to SSH. SSH key auth is still required."
  type        = string
  default     = "0.0.0.0/0"
}

variable "ssh_user" {
  description = "Linux user the CI deploys as. Must match the user in the SSH keys."
  type        = string
  default     = "deploy"
}

variable "ssh_pub_keys" {
  description = "OpenSSH public keys authorized for the deploy user. Include the CI deploy key first, then any human keys."
  type        = list(string)
}

variable "domain" {
  description = "Public hostname Caddy will serve. Leave empty to default to <vm-ip>.nip.io (free, real LE certs)."
  type        = string
  default     = ""
}

variable "acme_email" {
  description = "Contact email for Let's Encrypt certificate notices"
  type        = string
}

variable "image_owner" {
  description = "GitHub user/org that owns the ghcr.io images (used in compose.prod.yaml)"
  type        = string
  default     = "clydetn"
}

variable "github_repo" {
  description = "owner/repo string, used only for tagging and docs"
  type        = string
  default     = "ClydeTN/kamka-tasks"
}
