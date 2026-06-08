#!/usr/bin/env bash
# roll back to a previous tag without going through CI.
# usage: ssh deploy@<vm> "TAG=<sha> /opt/tasks/rollback.sh"
set -euo pipefail

: "${TAG:?TAG required -- a git sha that was previously deployed}"
: "${IMAGE_OWNER:=clydetn}"

# verify the images exist on ghcr before we pull -- avoids partial rollback
for service in api worker web; do
  if ! docker manifest inspect "ghcr.io/${IMAGE_OWNER}/tasks-${service}:${TAG}" >/dev/null 2>&1; then
    echo "image ghcr.io/${IMAGE_OWNER}/tasks-${service}:${TAG} not found" >&2
    exit 1
  fi
done

TAG=$TAG IMAGE_OWNER=$IMAGE_OWNER /opt/tasks/deploy.sh
