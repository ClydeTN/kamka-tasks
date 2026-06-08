# tasks

A small three-tier task tracker, productionised end-to-end: containerised,
built and shipped through CI, deployed to a GCP VM via Terraform, fronted by
Caddy with auto-TLS, and watched by Uptime Kuma. The app itself is a
deliberately simple TS + React + BullMQ stack — the point is the deployment
lifecycle around it.

- **Live**: <https://35.206.142.144.nip.io/>
- **Monitoring**: <https://status.35.206.142.144.nip.io/>
- **CI/CD**: GitHub Actions, [`actions` tab](https://github.com/ClydeTN/kamka-tasks/actions)
- **Container images**: [`ghcr.io/clydetn/tasks-{api,worker,web}`](https://github.com/ClydeTN?tab=packages&repo_name=kamka-tasks)

## architecture

```
   developer ──git push──► GitHub ─┬─► Actions: build api/worker/web → ghcr.io
                                   │
                                   └─► Actions: ssh deploy ─┐
                                                            ▼
                                                ┌────────────────────────────────┐
                                                │  GCP VM (Debian 12, e2-small)  │
                                                │  /opt/tasks  ▲                 │
                                                │              │ docker compose  │
                                                │  ┌───────────┴───────────────┐ │
                                                │  │ caddy ─► web (nginx+react)│ │
                                                │  │       └► api (express)    │ │
                                                │  │             ├► postgres   │ │
                                                │  │             ├► redis ◄──┐ │ │
                                                │  │             └► worker ──┘ │ │
                                                │  │       └► uptime kuma      │ │
                                                │  └───────────────────────────┘ │
                                                └────────────────────────────────┘
```

- **api** (`api/`): Express + TypeScript + Drizzle, owns the schema, enqueues
  BullMQ jobs, writes activity rows
- **worker** (`worker/`): BullMQ consumer for `due-reminders` — fires when a
  task with a due date hits its deadline
- **web** (`web/`): Vite + React + TypeScript bundle served by nginx
- **caddy**: edge proxy on `:80/:443`, automatic Let's Encrypt
- **uptime**: [Uptime Kuma](https://uptime.kuma.pet/) at `status.<domain>`

The deploy story: a push to `main` is built into three images at the commit
SHA, pushed to ghcr, SSH'd onto the VM, and `docker compose pull && up -d`'d.
Smart skip: a service whose code didn't change is **retagged registry-side**
at the new SHA instead of rebuilt (≈1 second instead of 30–60).

## running locally

You need Docker. Then:

```sh
cp .env.example .env       # set POSTGRES_PASSWORD to anything
docker compose up --build
```

Five healthy containers come up. The app is on <http://localhost:8080>.
`compose.override.yaml` is auto-merged in dev — it exposes each container's
port on the host so you can `psql`, `redis-cli`, or `curl` directly. Change
the host-side ports in `.env` if any are already taken.

Wipe DB between runs:

```sh
docker compose down -v
```

## running locally without docker

You need a local Postgres and Redis. Then three terminals:

```sh
cd api && npm install && npm run build
DATABASE_URL=postgres://localhost/tasks REDIS_URL=redis://localhost:6379 npm start

cd worker && npm install
DATABASE_URL=postgres://localhost/tasks REDIS_URL=redis://localhost:6379 npm start

cd web && npm install && npm run dev
```

The frontend's Vite dev server proxies `/api` to `localhost:4000` — see
`web/vite.config.ts`.

## deploying your own copy

Prerequisites:

- a GCP project with billing enabled (you need
  `billing.resourceAssociations.create` if you want to bind to a billing
  account in Terraform — easiest: deploy into a project that's already
  billing-linked)
- `gcloud`, `gh` (GitHub CLI), `terraform >= 1.6` installed locally
- a public GitHub repo at `OWNER/REPO`

**1. One-shot bootstrap (creates the WIF pool + tf-runner SA + TF state bucket):**

```sh
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
GITHUB_OWNER=YOUR_GH_USER GITHUB_REPO=YOUR_GH_USER/YOUR_REPO \
  ./infra/bootstrap.sh
```

This prints values you copy into `infra/versions.tf` (the GCS bucket name) and
`.github/workflows/{terraform,deploy}.yml` (the WIF provider path). After this,
**nothing else needs local credentials**.

**2. Generate a dedicated CI SSH key and store the private half as a GH secret:**

```sh
ssh-keygen -t ed25519 -f ~/.ssh/your_deploy_key -N "" -C "ci-deploy"
gh secret set DEPLOY_SSH_KEY < ~/.ssh/your_deploy_key
```

Add the **public** half to `infra/prod.auto.tfvars` (`ssh_pub_keys`).

**3. Trigger Terraform from CI (no local keys needed):**

```sh
gh workflow run terraform.yml -f action=apply
```

The job creates a static IP, firewall rules, a service account for the VM, and
the e2-small instance itself. First boot runs `cloud-init.sh` which installs
docker, creates the `deploy` user, generates a strong Postgres password into
`/opt/tasks/.env`, sets up UFW + fail2ban + unattended-upgrades, and
installs a nightly pg_dump systemd timer.

**4. First deploy:**

```sh
git push origin main          # or:
gh workflow run deploy.yml
```

Pipeline output ends with the URL and a green smoke-test step.

## day-to-day ops

| | |
|---|---|
| ship a change | `git push origin main` |
| roll back to an old SHA | `ssh deploy@<vm> 'TAG=<sha> /opt/tasks/rollback.sh'` |
| ssh in | `ssh deploy@<vm-ip>` (the IP is the `nat_ip` of `tasks-vm-ip`) |
| tail logs | `ssh deploy@<vm> 'docker compose -f /opt/tasks/compose.prod.yaml logs -f'` |
| manual db backup | `ssh deploy@<vm> 'sudo systemctl start tasks-backup-db.service'` (auto-runs nightly at 03:00 UTC, 14-day retention in `/opt/tasks/backups/`) |
| monitoring | <https://status.35.206.142.144.nip.io/> — first visit creates the admin user |
| tear it all down | `gh workflow run terraform.yml -f action=destroy` |

## secrets — how they flow

Three kinds of secret, three different places:

- **Postgres password**: generated by Terraform as a `random_password`,
  written into the VM's `/opt/tasks/.env` (mode 0600, owned by `deploy`),
  and stored in the TF state file inside the private GCS state bucket.
  Never in git, never in the image.
- **GCP credentials**: there are no long-lived ones. GitHub Actions exchanges
  its short-lived OIDC token for a GCP access token via Workload Identity
  Federation, scoped to this exact repo. The federation is set up once by
  `infra/bootstrap.sh`.
- **SSH key for CI to deploy**: dedicated keypair generated locally, public
  half goes into `prod.auto.tfvars` (not secret), private half stored as
  the `DEPLOY_SSH_KEY` GitHub Actions secret.

Local development uses `.env` (gitignored). A `.env.example` is committed
with safe defaults so a reviewer can `cp` and edit one value.

## repository tour

| path | what |
|---|---|
| `api/` | Express + TS + Drizzle. Schema, routes, BullMQ producer. |
| `worker/` | BullMQ consumer. Single job type. |
| `web/` | Vite + React + Tailwind dashboard. |
| `compose.yaml` | Local dev stack — builds locally, exposes service ports. |
| `compose.override.yaml` | Dev-only port mappings, auto-merged. |
| `compose.prod.yaml` | Production stack — pulls from ghcr, adds Caddy + Uptime Kuma, no host ports. |
| `infra/` | Terraform: VM, firewall, IP, IAM. Plus `bootstrap.sh` for the WIF setup. |
| `deploy/` | What gets shipped to the VM: `Caddyfile`, `deploy.sh`, `rollback.sh`. |
| `.github/workflows/` | `ci.yml` (path-filtered checks), `terraform.yml` (manual apply via WIF), `deploy.yml` (build → ghcr → SSH deploy). |

## what the worker does

The api enqueues a `due-reminders` BullMQ job whenever a task is created
with a due date. The job is delayed until the due date hits, then the worker
picks it up and writes a `due_reminder` row into the `activity` table — which
surfaces on the dashboard's live activity feed.

## dev vs prod parity

What's the same:

- same three images (api/worker/web), same Postgres major version, same Redis
  major version
- same migration path — `drizzle-orm/node-postgres/migrator` runs on api boot
- same env vars driving the same code paths

What differs:

- prod adds Caddy in front and Uptime Kuma alongside; dev exposes ports
  directly to the host
- prod images come from ghcr; dev builds locally
- prod uses a generated random Postgres password and a real LE cert; dev uses
  whatever's in `.env`
- prod runs unattended-upgrades, UFW, fail2ban, and a nightly DB backup; dev
  runs none of that

## known limitations / what I'd do next

- **single VM, no HA**: a reboot is downtime. Postgres on the same box as
  everything else. Acceptable for an assessment; for real prod I'd put
  Postgres on Cloud SQL and run the apps on >=2 VMs behind a managed LB,
  or move to a managed runtime like Cloud Run.
- **no automated tests in CI** — there aren't any to run. I'd add Vitest
  for the api (schema + routes) and Playwright for a happy-path web smoke.
- **secrets in the VM `.env`** rather than a real secret manager. Acceptable
  here because the VM is single-tenant and the file is 0600; a multi-VM
  story should pull from GCP Secret Manager.
- **migrations on boot** is convenient but couples deploys to schema work.
  For a real prod I'd run migrations as a one-shot k8s/job step before the
  api comes up, with a flyway/sqitch-style versioning.
- **no staging environment**. Could be added with a second `terraform
  workspace` and a `staging` GHA environment gating its deploys.

## attribution

The app was deliberately a generic "borrow from a friend" starter so the
focus stays on the deployment lifecycle. Everything in `infra/`, `deploy/`,
`.github/workflows/`, and the production-shaping commits is my own work.
