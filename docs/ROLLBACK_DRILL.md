# rollback drill — 2026-06-08

Exercised end-to-end against the live deploy at
`https://kamkait.ayoubabid.me`. Captures here so a reviewer doesn't have to
trust the script blindly.

## what we did

1. Push a new commit (v3) → CI auto-deployed it.
2. SSH'd to the VM, ran `TAG=<v1-sha> /opt/tasks/rollback.sh`.
3. Verified the **older** image tag came back across all three services.
4. Verified the public URL stayed `HTTP 200` through the swap.
5. Ran rollback.sh again with `TAG=<v3-sha>` to roll forward to current.

## evidence

| step | api / web / worker image tag | smoke |
|---|---|---|
| v3 live (pre-rollback) | `ghcr.io/clydetn/tasks-*:bdb2dd8…` | 200 |
| after `rollback.sh TAG=c931810…` | `ghcr.io/clydetn/tasks-*:c931810…` | 200 |
| after `rollback.sh TAG=bdb2dd8…` (forward) | `ghcr.io/clydetn/tasks-*:bdb2dd8…` | 200 |

```
$ ssh deploy@35.206.142.144 \
    "GHCR_TOKEN=… TAG=c931810dd3d754d739012fbc35fce657bc80af69 \
     IMAGE_OWNER=clydetn /opt/tasks/rollback.sh"

tasks-api-1    Up 13 seconds (healthy)   …/tasks-api:c931810…
tasks-web-1    Up  7 seconds (healthy)   …/tasks-web:c931810…
tasks-worker-1 Up  7 seconds (healthy)   …/tasks-worker:c931810…

$ curl -o /dev/null -w '%{http_code}\n' https://kamkait.ayoubabid.me/api/tasks
200
```

Each transition took ~10 seconds wall-clock on a warm VM (image was
already cached from the original deploy). No data loss — the postgres
volume is decoupled from the api container, so swapping the image is a
pure rolling restart.

## known constraint

The current rollback.sh assumes the caller passes a `GHCR_TOKEN` (any
github token with `read:packages` scope), because the image pull from
ghcr requires auth as long as the packages are private. New images
pushed by the deploy workflow are now labeled with
`org.opencontainers.image.source` so they link to this public repo and
inherit its visibility — once all old images expire / are repushed, the
token requirement on rollback can go away.
