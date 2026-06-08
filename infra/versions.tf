terraform {
  required_version = ">= 1.6"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.30"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # state lives in a GCS bucket created by infra/bootstrap.sh.
  # tf-runner has objectAdmin on this bucket via WIF.
  backend "gcs" {
    bucket = "685230180124-tasks-tfstate"
    prefix = "infra"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
  zone    = var.zone
}
