# tasks

Tiny task tracker I picked up from a friend. Three services plus a
database and a redis:

- `api/` — Express + TypeScript + Drizzle ORM, talks to Postgres and Redis
- `worker/` — BullMQ consumer that processes due-date reminders
- `web/` — Vite + React + TypeScript single-page app

## running it (the easy way)

    cp .env.example .env       # then edit POSTGRES_PASSWORD
    docker compose up --build

That brings up postgres, redis, the api, the worker, and the nginx-served
frontend. The api runs drizzle migrations on boot. Open
<http://localhost:8080>.

The `compose.override.yaml` is auto-merged and only matters for dev —
it exposes each service's port on the host so you can `psql`,
`redis-cli`, or `curl` directly. Change the host ports in `.env` if
something else is already on them.

To wipe the database between runs:

    docker compose down -v

## running it the long way (without docker)

You need a Postgres and a Redis running somewhere. Then:

    cd api && npm install && npm run build
    DATABASE_URL=postgres://localhost/tasks REDIS_URL=redis://localhost:6379 npm start

    cd worker && npm install
    DATABASE_URL=postgres://localhost/tasks REDIS_URL=redis://localhost:6379 npm start

    cd web && npm install && npm run dev

The frontend dev server proxies `/api` to `localhost:4000` — see
`web/vite.config.ts`.

## what the worker does

The api enqueues a `due-reminders` BullMQ job whenever a task is created
with a due date. The job is delayed until the due date hits, then the
worker picks it up and writes a `due_reminder` row into the `activity`
table — which surfaces on the dashboard.

## secrets

Nothing real is committed. Copy `.env.example` to `.env` and supply
your own values; `.env` is in `.gitignore`. In CI / on a deployed host,
use the platform's secret store and never bake credentials into images.
