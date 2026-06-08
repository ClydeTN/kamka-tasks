#!/usr/bin/env bash
# runs on the VM, invoked by the github actions deploy workflow over SSH.
# expects TAG and IMAGE_OWNER to be set in the env (the workflow sets them).
#
# what this does:
#   1. updates /opt/tasks/.env with the requested TAG so docker compose
#      resolves the right ghcr image
#   2. logs into ghcr so pulls work even for private images
#   3. docker compose pull && up -d --remove-orphans
#   4. waits until every container reports healthy, or fails the deploy
set -euo pipefail

cd /opt/tasks

: "${TAG:?TAG env var must be set (usually \$GITHUB_SHA)}"
: "${IMAGE_OWNER:?IMAGE_OWNER env var must be set}"

# rewrite the TAG line in .env atomically. .env is owned by the deploy user
# (this script's caller) so no sudo needed.
TMP=$(mktemp)
grep -v -E '^(TAG|IMAGE_OWNER)=' /opt/tasks/.env > "$TMP" || true
{
  echo "TAG=$TAG"
  echo "IMAGE_OWNER=$IMAGE_OWNER"
} >> "$TMP"
install -m 600 "$TMP" /opt/tasks/.env
rm -f "$TMP"

# ghcr login -- the workflow passes a short-lived GITHUB_TOKEN through as
# GHCR_TOKEN. tokens scope to packages:read here, which is enough to pull.
if [ -n "${GHCR_TOKEN:-}" ]; then
  echo "$GHCR_TOKEN" | docker login ghcr.io -u "$IMAGE_OWNER" --password-stdin >/dev/null
fi

docker compose --env-file /opt/tasks/.env -f compose.prod.yaml pull
docker compose --env-file /opt/tasks/.env -f compose.prod.yaml up -d --remove-orphans

# wait for everything to settle. 120s = enough for cold-start, migration,
# and caddy's first ACME exchange on a fresh VM.
echo "waiting for containers to become healthy..."
deadline=$(( $(date +%s) + 120 ))
while true; do
  if (( $(date +%s) > deadline )); then
    echo "deploy failed -- containers not healthy after 120s:"
    docker compose -f compose.prod.yaml ps
    exit 1
  fi
  unhealthy=$(docker compose -f compose.prod.yaml ps --format '{{.Service}}\t{{.Health}}' \
              | awk -F'\t' '$2 != "healthy" && $2 != "" {print $1}')
  if [ -z "$unhealthy" ]; then
    break
  fi
  sleep 3
done

echo "deploy OK at tag $TAG"
docker compose -f compose.prod.yaml ps
