#!/usr/bin/env bash
# one-shot bootstrap for the GCP side.
#
# what this does:
#   1. (optional) creates a new project. SKIPPED here -- the assessment
#      reuses the existing `formulai` project because the gmail user
#      cannot link new projects to the billing account.
#   2. enables the required APIs on the project.
#   3. creates a Workload Identity Pool + OIDC provider that trusts the
#      GitHub Actions token issuer, scoped to a specific GitHub owner.
#   4. creates the `tasks-tf-runner` service account that Terraform
#      impersonates from CI, and grants it project-scoped admin roles
#      (compute, IAM, service usage). NOT roles/owner.
#   5. binds the GitHub OIDC identity for the repo `ClydeTN/kamka-tasks`
#      to the SA via `roles/iam.workloadIdentityUser`.
#   6. creates a GCS bucket for Terraform remote state, versioned,
#      uniform-access, public-access-prevented. tf-runner gets
#      `roles/storage.objectAdmin` on it.
#
# run this once, locally, with your own gcloud credentials. after this
# script finishes, nothing else needs local credentials -- CI authenticates
# via WIF and Terraform stores its state in the GCS bucket.
#
# values produced (paste into infra/terraform.tfvars and GH workflow):
#   PROJECT_ID                = formulai
#   PROJECT_NUMBER            = 685230180124
#   WIF_PROVIDER              = projects/685230180124/locations/global/workloadIdentityPools/gh-actions-tasks/providers/github
#   SA_EMAIL                  = tasks-tf-runner@formulai.iam.gserviceaccount.com
#   TFSTATE_BUCKET            = 685230180124-tasks-tfstate

set -euo pipefail

PROJECT_ID="${PROJECT_ID:-formulai}"
GITHUB_OWNER="${GITHUB_OWNER:-ClydeTN}"
GITHUB_REPO="${GITHUB_REPO:-${GITHUB_OWNER}/kamka-tasks}"
REGION="${REGION:-europe-west1}"
POOL_ID="gh-actions-tasks"
PROVIDER_ID="github"
SA_NAME="tasks-tf-runner"

PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
TFSTATE_BUCKET="${PROJECT_NUMBER}-tasks-tfstate"

echo "==> enabling APIs"
gcloud services enable \
  compute.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  sts.googleapis.com \
  cloudresourcemanager.googleapis.com \
  logging.googleapis.com \
  monitoring.googleapis.com \
  storage.googleapis.com \
  --project="$PROJECT_ID"

echo "==> creating WIF pool"
gcloud iam workload-identity-pools create "$POOL_ID" \
  --location=global \
  --display-name="GitHub Actions (tasks)" \
  --project="$PROJECT_ID" || true

echo "==> creating OIDC provider"
gcloud iam workload-identity-pools providers create-oidc "$PROVIDER_ID" \
  --location=global \
  --workload-identity-pool="$POOL_ID" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner,attribute.ref=assertion.ref" \
  --attribute-condition="assertion.repository_owner == '${GITHUB_OWNER}'" \
  --project="$PROJECT_ID" || true

echo "==> creating tf-runner SA"
gcloud iam service-accounts create "$SA_NAME" \
  --display-name="Terraform runner for tasks deploy" \
  --project="$PROJECT_ID" || true

echo "==> granting project roles"
for ROLE in \
    roles/compute.admin \
    roles/iam.serviceAccountAdmin \
    roles/iam.serviceAccountUser \
    roles/resourcemanager.projectIamAdmin \
    roles/serviceusage.serviceUsageAdmin; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$SA_EMAIL" \
    --role="$ROLE" \
    --condition=None \
    --quiet >/dev/null
done

echo "==> binding github OIDC -> SA (only ${GITHUB_REPO} can impersonate)"
gcloud iam service-accounts add-iam-policy-binding "$SA_EMAIL" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/attribute.repository/${GITHUB_REPO}" \
  --project="$PROJECT_ID" >/dev/null

echo "==> creating GCS bucket for terraform state"
gcloud storage buckets create "gs://$TFSTATE_BUCKET" \
  --project="$PROJECT_ID" \
  --location="$REGION" \
  --uniform-bucket-level-access \
  --public-access-prevention 2>&1 | grep -v 'already' || true
gcloud storage buckets update "gs://$TFSTATE_BUCKET" --versioning >/dev/null
gcloud storage buckets add-iam-policy-binding "gs://$TFSTATE_BUCKET" \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/storage.objectAdmin" >/dev/null

echo
echo "bootstrap done. values for terraform.tfvars / GH workflow:"
echo "  PROJECT_ID     = $PROJECT_ID"
echo "  PROJECT_NUMBER = $PROJECT_NUMBER"
echo "  WIF_PROVIDER   = projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/providers/${PROVIDER_ID}"
echo "  SA_EMAIL       = $SA_EMAIL"
echo "  TFSTATE_BUCKET = $TFSTATE_BUCKET"
