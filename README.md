# tasks

Tiny task tracker I picked up from a friend. Three services plus a
database and a redis:

- `api/` — Express + TypeScript + Drizzle ORM, talks to Postgres and Redis
- `worker/` — BullMQ consumer that processes due-date reminders
- `web/` — Vite + React + TypeScript single-page app

## running it

You need a Postgres and a Redis running somewhere. Then:

    cd api && npm install && npm run build
    DATABASE_URL=postgres://localhost/tasks REDIS_URL=redis://localhost:6379 npm start

    cd worker && npm install
    DATABASE_URL=postgres://localhost/tasks REDIS_URL=redis://localhost:6379 npm start

    cd web && npm install && npm run dev

The api runs drizzle migrations on startup; nothing to do by hand. The
frontend dev server proxies `/api` to `localhost:4000` — see
`web/vite.config.ts`.

## what the worker does

The api enqueues a `due-reminders` BullMQ job whenever a task is created
with a due date. The job is delayed until the due date hits, then the
worker picks it up and writes a `due_reminder` row into the `activity`
table — which surfaces on the dashboard.
