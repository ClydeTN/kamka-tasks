#!/usr/bin/env bash
# roll back to a previous tag without going through CI.
# usage: ssh deploy@<vm> "TAG=<sha> /opt/tasks/rollback.sh"
set -euo pipefail

: "${TAG:?TAG required -- a git sha that was previously deployed}"
: "${IMAGE_OWNER:=clydetn}"

# delegate to deploy.sh -- it already does docker login + pull. if any
# image at the requested tag is missing on ghcr, the pull will fail loudly
# and the deploy step exits non-zero. no value in double-checking.
TAG=$TAG IMAGE_OWNER=$IMAGE_OWNER /opt/tasks/deploy.sh
