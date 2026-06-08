# tasks

A small three-tier task tracker (api + worker + web + postgres + redis), wired
end-to-end: containerised, built and shipped by GitHub Actions, deployed to a
GCP VM by Terraform, fronted by Caddy with auto-TLS, watched by Uptime Kuma.
The app is deliberately simple — the work is in the lifecycle around it.

- **Live**: <https://kamkait.ayoubabid.me/>
- **Status**: <https://status.kamkait.ayoubabid.me/>
- **CI/CD**: <https://github.com/ClydeTN/kamka-tasks/actions>
- **PDF**: [`docs/ARCHITECTURE.pdf`](docs/ARCHITECTURE.pdf)

## TL;DR — clone and run

You need **Docker** with the `compose` plugin. Nothing else.

```sh
git clone https://github.com/ClydeTN/kamka-tasks
cd kamka-tasks
cp .env.example .env          # set POSTGRES_PASSWORD to anything
docker compose up --build
```

Open <http://localhost:8080>. Five containers come up:

| port | service |
|---|---|
| 8080 | `web` (nginx + react bundle) |
| 4000 | `api` (express + ts + drizzle) |
| 5432 | `postgres` |
| 6379 | `redis` |
| —    | `worker` (BullMQ consumer, no port) |

The api runs Drizzle migrations on boot; nothing to do by hand. To wipe the
DB and start clean: `docker compose down -v`.

## Architecture

```
   developer ──git push──► GitHub ─┬─► Actions: build api/worker/web → ghcr.io
                                   │
                                   └─► Actions: OIDC→GCP, ssh deploy
                                                        ▼
                                          ┌────────────────────────────────┐
                                          │  GCP VM (Debian 12, e2-small)  │
                                          │   docker compose -f prod.yaml  │
                                          │                                │
                                          │   caddy ─► web  (nginx+react)  │
                                          │        └─► api  (express)      │
                                          │              ├─► postgres      │
                                          │              ├─► redis ◄──┐    │
                                          │              └─► worker ──┘    │
                                          │        └─► uptime-kuma         │
                                          └────────────────────────────────┘
```

- **api** owns the schema (Drizzle migrations on boot), enqueues a
  `due-reminders` BullMQ job whenever a task has a due date, writes activity
  rows on every state change. Caches the task list in Redis (30s TTL).
- **worker** is a single BullMQ consumer — when a reminder fires it checks
  the task still exists & isn't done, then inserts a `due_reminder` row into
  `activity`.
- **web** is a Vite + React + Tailwind SPA, built into a static bundle and
  served by nginx.
- **caddy** terminates TLS (auto Let's Encrypt) and proxies `/api/*` to the
  api, everything else to the web.

## Persistent data (volumes)

Compose declares named volumes so nothing is lost between `up`/`down`. Use
`docker compose down -v` only when you want a clean DB.

| volume | what | restore from |
|---|---|---|
| `pgdata` | postgres tables (tasks, tags, comments, activity, …) | nightly `pg_dump`s in `/opt/tasks/backups/` on the VM (14-day retention) |
| `redisdata` | BullMQ job queue + cache state | regenerated automatically; no backup needed |
| `caddy_data` | Let's Encrypt account + certificates | regenerated automatically; deleting forces re-issuance |
| `caddy_config` | runtime Caddy state | regenerated automatically |
| `uptime_data` | Uptime Kuma sqlite (monitors + history) | dump/restore manually if you care; the assessment doesn't require it |

To run a manual DB backup on the VM:

```sh
ssh deploy@<vm-ip> sudo systemctl start tasks-backup-db.service
```

## Deploying your own copy

Prerequisites: `gcloud`, `gh` (GitHub CLI), `terraform >= 1.6`, a GCP project
with billing enabled, a public GitHub repo at `OWNER/REPO`.

```sh
# 1. one-shot bootstrap of the GCP side (only thing that needs your gcloud creds).
#    creates the WIF pool, the tf-runner SA, and the GCS state bucket.
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
GITHUB_OWNER=YOUR_GH_USER GITHUB_REPO=YOUR_GH_USER/YOUR_REPO \
  ./infra/bootstrap.sh

# 2. generate a dedicated CI deploy key, store the private half in GH secrets.
ssh-keygen -t ed25519 -f ~/.ssh/your_deploy_key -N "" -C "ci-deploy"
gh secret set DEPLOY_SSH_KEY < ~/.ssh/your_deploy_key
# then add the public half to infra/prod.auto.tfvars (ssh_pub_keys).

# 3. provision the VM via Terraform (runs in CI via OIDC — no local keys needed).
gh workflow run terraform.yml -f action=apply

# 4. ship the app.
git push origin main
```

Everything after step 1 is OIDC-only — no service-account JSON, no key files.

## Day-to-day ops

| | |
|---|---|
| ship a change | `git push origin main` (deploy.yml runs) |
| roll back to an old SHA | `ssh deploy@<vm> 'GHCR_TOKEN=<gh_token> TAG=<sha> /opt/tasks/rollback.sh'` — exercised end-to-end, evidence in `docs/ROLLBACK_DRILL.md` |
| ssh in | `ssh deploy@<vm-ip>` |
| tail prod logs | `ssh deploy@<vm> 'docker compose -f /opt/tasks/compose.prod.yaml logs -f'` |
| trigger a manual backup | `ssh deploy@<vm> sudo systemctl start tasks-backup-db.service` |
| open monitoring | <https://status.kamkait.ayoubabid.me/> |
| tear it all down | `gh workflow run terraform.yml -f action=destroy` |

## Branch & contribution policy

| branch | CI runs? | auto-deploys? |
|---|---|---|
| `main` | ✅ on push + PR | ✅ pushes deploy to prod |
| `develop` | ✅ on push + PR | ❌ never deploys |
| feature branches | ✅ once a PR is opened | ❌ |

Workflow: branch from `develop` → PR into `develop` (CI must be green) →
when ready, PR `develop` → `main` for the release. `main` is the only
branch that has the right to touch prod.

## Secrets — how each one flows

| secret | where it lives | who writes it |
|---|---|---|
| Postgres password | `/opt/tasks/.env` (0600, `deploy`-owned) + Terraform state in private GCS bucket | `random_password.postgres` resource at first apply |
| GCP credentials | **nowhere on disk** — short-lived OIDC tokens minted per workflow run | GitHub OIDC issuer ⇄ GCP STS via WIF |
| CI deploy SSH key | private half in the `DEPLOY_SSH_KEY` GitHub Actions secret; public half committed to `infra/prod.auto.tfvars` | generated once locally with `ssh-keygen` |
| Local dev DB password | `.env` (gitignored), copied from `.env.example` | the developer |

`.env.example` is the only file you'll edit before a first local run, and
the value it asks for (`POSTGRES_PASSWORD`) is meaningless because the
local DB is throw-away.

## Dev vs prod parity

Same images / migrations / env-var names. What differs:

- **edge**: dev exposes service ports directly to the host (via
  `compose.override.yaml`); prod hides everything behind Caddy
- **registry**: dev builds locally, prod pulls from `ghcr.io`
- **secrets**: dev uses whatever you wrote in `.env`; prod uses a
  Terraform-generated random password and a Caddy-managed LE cert
- **hardening**: prod adds UFW, fail2ban, unattended-upgrades, and a
  nightly `pg_dump` systemd timer

## Repository tour

| path | what |
|---|---|
| `api/` | Express + TS + Drizzle. Schema, routes, BullMQ producer. 4-stage Dockerfile. |
| `worker/` | BullMQ consumer. One job type. 2-stage Dockerfile. |
| `web/` | Vite + React + TS + Tailwind. 3-stage Dockerfile (deps → vite build → nginx serve). |
| `compose.yaml` | Local stack: builds locally, healthchecks, named volumes. |
| `compose.override.yaml` | Dev-only host port mappings, auto-merged. |
| `compose.prod.yaml` | Prod stack: pulls from ghcr, adds Caddy + Uptime Kuma, no host ports. |
| `deploy/` | What gets shipped to the VM: `Caddyfile`, `deploy.sh`, `rollback.sh`. |
| `infra/` | Terraform: VM, firewall, IP, IAM, cloud-init startup script, and `bootstrap.sh` for the WIF setup. |
| `.github/workflows/` | `ci.yml` (path-filtered checks), `terraform.yml` (manual apply via WIF), `deploy.yml` (build → ghcr → SSH deploy). |
| `docs/ARCHITECTURE.{md,pdf}` | The submission PDF: diagram + decisions + tradeoffs + limits. |
| `docs/ROLLBACK_DRILL.md` | Evidence the rollback path actually works. |

## Known limits & what I'd do next

- single VM = a reboot is downtime; would move to Cloud Run + Cloud SQL for real prod
- no automated test suite — would add Vitest for the api and one Playwright happy-path for the web
- migrations run on api boot — convenient now, would split into a one-shot job for real prod
- secrets live in `/opt/tasks/.env` — fine for a single-tenant VM, but a multi-VM story should pull from GCP Secret Manager

More detail and reasoning in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
