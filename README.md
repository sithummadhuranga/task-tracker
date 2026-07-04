# Task Tracker

A full-stack Task Tracker with role-based access control and real-time task updates, built as
a take-home assignment (`docs/ASSESMENT.md`). The functional contract is locked in
`docs/FEATURES_AND_API.md`, and the architectural decisions behind the stack below are in
`docs/ARCHITECTURE.md` — this file covers how to actually run, test, and deploy the project.

## Stack

| Layer            | Choice                                                                  |
| ---------------- | ----------------------------------------------------------------------- |
| Backend          | Express + TypeScript                                                    |
| ORM / DB         | Prisma + PostgreSQL                                                     |
| Cache / sessions | Redis                                                                   |
| Real-time        | Socket.io                                                               |
| Frontend         | React + TypeScript + Vite, Tailwind CSS, TanStack Query                 |
| Validation       | Zod, shared between apps via `packages/shared-types`                    |
| Testing          | Jest + Supertest (backend), Vitest + React Testing Library (frontend)   |
| Monorepo         | pnpm workspaces + Turborepo                                             |
| CI/CD            | GitHub Actions → DigitalOcean App Platform (backend), Vercel (frontend) |

Full rationale for each choice is in `docs/ARCHITECTURE.md`.

## Prerequisites

- Node.js 22+ (see `.nvmrc`)
- pnpm 10+ (`corepack enable` will pick up the pinned version automatically)
- Docker + Docker Compose, if you want the fully containerized local setup

## Setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Environment configuration

Copy the example env files and fill in real values:

```bash
cp .env.example .env                       # docker-compose (Postgres/Redis/ports)
cp apps/backend/.env.example apps/backend/.env
```

| Variable       | Used by | Notes                                   |
| -------------- | ------- | --------------------------------------- |
| `DATABASE_URL` | backend | PostgreSQL connection string            |
| `REDIS_URL`    | backend | Redis connection string                 |
| `CORS_ORIGIN`  | backend | Frontend origin allowed to call the API |
| `NODE_ENV`     | backend | `development` \| `test` \| `production` |
| `PORT`         | backend | Defaults to `4000`                      |

The backend fails fast at boot with a clear error if any of these are missing or malformed
(`src/common/config/env.ts`) — it will not silently start in a broken state.

### 3. Database setup

Bring up Postgres and Redis (via Docker, or point at your own local instances):

```bash
docker compose up -d postgres redis
```

Then apply the schema and seed the RBAC catalog:

```bash
pnpm --filter @task-tracker/backend run prisma:migrate
pnpm --filter @task-tracker/backend run prisma:seed
```

The seed is idempotent — safe to re-run. It creates the `USER`/`ADMIN` roles and the fixed
10-key permission catalog described in `docs/FEATURES_AND_API.md` §1.

### 4. Run the apps

Either run everything through Docker Compose:

```bash
docker compose up --build
```

This brings up Postgres, Redis, the backend (`http://localhost:4000`), and the frontend
(`http://localhost:5173`), each with healthchecks.

Or run backend and frontend directly against the Dockerized Postgres/Redis:

```bash
pnpm --filter @task-tracker/backend dev     # http://localhost:4000
pnpm --filter @task-tracker/frontend dev    # http://localhost:5173
```

## Testing

```bash
pnpm turbo run test    # unit + e2e (backend), component tests (frontend), across every package
pnpm turbo run lint
pnpm turbo run build
```

CI (`.github/workflows/ci.yml`) runs all three on every push and pull request, against real
Postgres and Redis service containers — nothing merges without passing.

## Deployment

The backend deploys to **DigitalOcean App Platform**, the frontend to **Vercel**, across two
permanent environments: `staging` (tracks the `develop` branch) and `production` (tracks
`main`). Database is **Neon** (one project, two branches), Redis is **Upstash** (two separate
free-tier databases, one per environment).

The backend image is built and pushed to **GitHub Container Registry** by CI itself
(`docker/build-push-action`) — DigitalOcean never reads this repository directly, it only ever
pulls a pre-built image. No secret value is ever committed, encrypted or otherwise; everything
sensitive lives in GitHub Environment secrets and is substituted into the DigitalOcean app spec
(`.do/app.staging.yaml` / `.do/app.production.yaml`) at deploy time.

### One-time account setup (not automatable — requires dashboard access)

1. **Neon**: create a project, then a child branch named `staging` off `main`. Grab the direct
   (non-pooled) connection string for each branch.
2. **Upstash**: create two Redis databases (`*-staging`, `*-production`), grab the `rediss://`
   connection string for each.
3. **DigitalOcean**: Account → API → generate a personal access token (read+write).
4. **GitHub Container Registry**: Settings → Developer settings → Personal access tokens
   (classic) → generate one scoped to `read:packages` — DigitalOcean needs this to pull the
   (public) image.
5. **This repo** → Settings → Environments → create `staging` and `production`, each with:
   - Secrets: `DATABASE_URL`, `REDIS_URL`
   - Variable: `CORS_ORIGIN` (the environment's Vercel URL)
   - Repo-level secrets (not environment-scoped): `DIGITALOCEAN_ACCESS_TOKEN`, `GHCR_PAT`
6. **Vercel**: import the repo once, Root Directory `apps/frontend`, framework Vite. Add
   `VITE_API_URL` scoped to Production (→ prod backend URL) and to Preview scoped specifically
   to the `develop` branch (→ staging backend URL). `main` auto-deploys to production; pushes
   to `develop` redeploy that branch's stable preview URL.

Once secrets are in place, every push to `develop`/`main` runs CI, and only on success builds,
pushes, and deploys the corresponding environment — no manual redeploy steps after that.

## Assumptions

- Ownership-check failures return `404`, not `403` (masks whether a resource exists from a
  caller with no visibility into it) — locked in `docs/FEATURES_AND_API.md` §5.
- Permissions are resolved server-side on every request via Redis; the JWT access token never
  carries permission data, so a revoked permission takes effect immediately rather than waiting
  for token expiry.
- Past due dates are allowed on task creation — a task can be created already overdue.
- Tasks are hard-deleted in v1; no soft-delete or audit trail.
- Registration always assigns the `USER` role — role is never client-controlled, even if sent
  in the request body.

## Future Improvements

- Soft-delete / audit log for tasks (explicitly out of scope for v1 per `docs/ARCHITECTURE.md`).
- Socket.io Redis adapter, if the backend ever needs more than one instance — not needed at the
  current `instance_count: 1` scale, but the Redis dependency for it is already in place.
- Smaller backend Docker image — `@prisma/client`'s current production install pulls in
  several MB of tooling (Prisma Studio, an embedded WASM Postgres, the `prisma` CLI itself)
  that the running server never uses.
- Automated GHCR image cleanup — old image digests accumulate in the package's version history
  with no retention policy configured yet.
