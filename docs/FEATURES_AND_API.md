# Task Tracker — Features & API Contract

This document is the single source of truth for functional scope. If a behavior is not
described here, it is not in scope — do not invent it. If something is ambiguous, stop and
ask rather than assume.

Status: LOCKED for v1 build. Changes require updating this file first.

---

## 1. Entities

### User
| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| email | string | unique, required |
| passwordHash | string | bcrypt, cost 12, never returned in any response |
| name | string | required |
| createdAt | datetime | |
| updatedAt | datetime | |

Note: `role` is NOT a field on User in v1. Roles are assigned via `UserRole`, not a column
on the user record. This is intentional — see Section 2.

### Role
| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| name | string | unique, e.g. "USER", "ADMIN" |
| isSystem | boolean | true for USER/ADMIN, prevents deletion |
| createdAt | datetime | |

Seeded on first boot: `USER`, `ADMIN` (both `isSystem: true`).

### Permission
Fixed, code-defined catalog. NOT admin-creatable via API — permissions only mean something
if a real enforcement point checks for them. Stored in DB as a seeded read-only table so
they can be referenced by FK, but the catalog itself is defined in code and reseeded on boot.

Catalog (v1, exhaustive):
```
task:create
task:read:own
task:read:any
task:update:own
task:update:any
task:delete:own
task:delete:any
role:manage
user:manage
permission:assign
```

Default seeding:
- Role `USER` gets: `task:create`, `task:read:own`, `task:update:own`, `task:delete:own`
- Role `ADMIN` gets: all permissions in the catalog

### RolePermission
Join table: `roleId`, `permissionId`. Many-to-many.

### UserRole
Join table: `userId`, `roleId`. Many-to-many (a user may hold multiple roles).

### UserPermission
Direct per-user override.
| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| userId | UUID | FK |
| permissionId | UUID | FK |
| effect | enum | `GRANT` \| `DENY` |

### Task
| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| title | string | required, max 200 chars |
| description | string | optional, max 2000 chars |
| status | enum | `TODO` \| `IN_PROGRESS` \| `DONE`, default `TODO` |
| dueDate | datetime | required; past dates ARE allowed (task can be created already overdue) |
| ownerId | UUID | FK to User |
| version | int | starts at 1, incremented on every successful update — see §5 PATCH |
| createdAt | datetime | |
| updatedAt | datetime | |

Default list sort: `createdAt DESC`.

### RefreshSession (Redis, not Postgres)
Key: `session:{tokenId}` → value: `{ userId }`, TTL = 7 days.
Reverse index: `user-sessions:{userId}` → Set of active `tokenId`s.

### Permission cache (Redis)
Key: `permissions:{userId}` → Set of permission key strings, TTL = 60s, actively invalidated
on any role/permission change affecting that user.
Reverse index: `role:{roleId}:users` → Set of `userId`s currently holding that role (used to
invalidate every affected user's cache when a role's permission set changes).

---

## 2. Authorization model

**Effective permissions** for a user = (union of permissions from all assigned roles)
`+` permissions with a direct `UserPermission` of effect `GRANT`
`−` permissions with a direct `UserPermission` of effect `DENY`.

**DENY always wins.** If a permission is present via role AND has a direct DENY override, the
result is: user does NOT have that permission. This is a fail-closed design — do not change it.

Permissions are resolved server-side on every request via the Redis cache described above.
Permissions are **never** embedded in the JWT access token — the token only carries
`{ sub: userId }`. This is intentional: baking permissions into the JWT would mean a revoked
permission stays valid until token expiry (up to 15 minutes of stale access). Every request
re-checks the Redis-cached permission set instead.

Ownership vs. role/permission are two separate checks and must both be tested independently:
1. Does the user have the relevant permission at all (e.g. `task:update:own` OR `task:update:any`)?
2. If only `:own`, does `task.ownerId === req.user.id`?

---

## 3. Authentication & Session — Endpoints

All endpoints in this document are served under the `/api/v1` prefix (e.g.
`POST /api/v1/auth/register`). The `v1` segment versions the URL surface itself — unrelated
to this document's own "LOCKED for v1 build" status line above, which is about the functional
spec, not the URL.

### POST /api/v1/auth/register
- Body: `{ email, password, name }`
- `role` in request body is ignored if present — never trust client-supplied role/permissions.
- New user is automatically assigned the `USER` role (one `UserRole` row created).
- Password validated: min 8 chars, at least one number.
- Duplicate email → `409 { error: "Conflict", message: "email already registered" }`
- Success → `201`, returns user object WITHOUT passwordHash. Does NOT auto-login — client
  must call `/login` next.

### POST /api/v1/auth/login
- Body: `{ email, password }`
- Invalid email OR invalid password → same generic `401 { message: "invalid credentials" }`
  — never distinguish which one was wrong (prevents user enumeration).
- Success:
  - Issues access token: JWT, 15 min expiry, payload `{ sub: userId }` only.
  - Issues refresh token: opaque random string (32 bytes, base64url), stored in Redis per
    Section 1, delivered as httpOnly + Secure + SameSite=Strict cookie named `refresh_token`.
    **Never** returned in the JSON body.
  - Response body: `{ accessToken, user: { id, email, name } }`

### POST /api/v1/auth/refresh
- Reads `refresh_token` from the cookie only — never from body or query string.
- Validates against Redis. On success:
  - **Rotates**: old tokenId deleted from Redis, new one issued and stored, new cookie set.
  - Returns new `{ accessToken }`.
- If the presented token is not found in Redis (already rotated/expired/revoked) → treat as
  possible theft: revoke ALL sessions for that user (delete entire `user-sessions:{userId}`
  set), clear cookie, return `401`. Client must force full re-login.

### POST /api/v1/auth/logout
- Requires valid access token.
- Deletes the current session's tokenId from Redis, clears cookie. `204`.

### POST /api/v1/auth/logout-all
- Requires valid access token.
- Deletes every session in `user-sessions:{userId}`. `204`.
- Also usable by an admin (with `user:manage`) against another user's id via
  `POST /api/v1/users/:id/logout-all`.

### GET /api/v1/auth/me
- Requires valid access token.
- Returns `{ user: { id, email, name }, roles: string[], permissions: string[] }`.
- This is the endpoint the frontend calls on load to drive ALL UI permission gating.

---

## 4. RBAC Administration — Endpoints

All endpoints below require the caller to hold the stated permission. Enforcement is via
`requirePermission('<key>')` middleware — never inline role checks.

### GET /api/v1/permissions
- Requires: `role:manage` OR `permission:assign`
- Returns the fixed catalog (read-only): `[{ id, key }]`

### GET /api/v1/roles
- Requires: `role:manage`
- Returns all roles with their assigned permission keys.

### POST /api/v1/roles
- Requires: `role:manage`
- Body: `{ name }`. Creates a new role, `isSystem: false`, no permissions assigned initially.

### PATCH /api/v1/roles/:id
- Requires: `role:manage`
- Body: `{ name? }`. Cannot rename in a way that collides with existing role names.
- `name` omitted, or identical to the role's current name, is a deliberate no-op: `200` with the
  unchanged role, not an error. The contract has no "at least one field must change" requirement.

### DELETE /api/v1/roles/:id
- Requires: `role:manage`
- `403` if `role.isSystem === true`. Otherwise deletes role and cascades UserRole rows.

### PATCH /api/v1/roles/:id/permissions
- Requires: `role:manage`
- Body: `{ permissionKeys: string[] }` — full replacement of the role's permission set.
- After update: invalidate Redis permission cache for every user in `role:{id}:users`.

### POST /api/v1/users/:id/roles
- Requires: `role:manage` (assigning roles is a role:manage action, not user:manage)
- Body: `{ roleIds: string[] }` — full replacement of the user's role assignments.
- Invalidate that user's Redis permission cache immediately after.

### GET /api/v1/users
- Requires: `user:manage`
- Returns paginated user list with their assigned role names.

### GET /api/v1/users/:id
- Requires: `user:manage`
- Returns user detail: roles, direct permission overrides (grants/denies).

### POST /api/v1/users/:id/permissions
- Requires: `permission:assign`
- Body: `{ permissionKey: string, effect: "GRANT" | "DENY" }`
- Upserts a UserPermission row. Invalidate that user's Redis permission cache immediately.

### DELETE /api/v1/users/:id/permissions/:permissionId
- Requires: `permission:assign`
- Removes a direct override (reverts to role-derived permissions only for that key).

### GET /api/v1/users/lookup
- **Added after the initial lock**, with explicit sign-off, to let the frontend resolve a
  task's `ownerId` to a display name — the Task entity only ever carries the raw id, and
  `GET /users`/`GET /users/:id` require `user:manage`, a different permission than
  `task:read:any`, so a task-scoped caller had no locked way to resolve a name at all.
- Requires: `task:read:any` OR `user:manage`.
- Query params: exactly one of `ids` (comma-separated user ids) or `q` (free-text search
  against name/email, case-insensitive, capped at 10 results) — 400 if neither or both are
  present.
- Response: `[{ id, name, email }]`. Never includes `passwordHash` or any other field.

---

## 5. Task Management — Endpoints

### POST /api/v1/tasks
- Requires: `task:create`
- Body: `{ title, description?, status?, dueDate, ownerId? }`
- `ownerId` in body is only honored if caller holds `task:update:any`-equivalent admin scope
  (practically: if caller has `task:read:any`, they may set an arbitrary owner; otherwise
  `ownerId` is forced to `req.user.id` regardless of what's sent).
- `status` defaults to `TODO` if omitted.
- Validation: title required (≤200 chars), dueDate must be a valid ISO date (past allowed).
- Success → `201`, then emits `task.created` WebSocket event (see Section 6).

### GET /api/v1/tasks/:id
- Requires: `task:read:own` OR `task:read:any`.
- If caller only has `:own` and `task.ownerId !== req.user.id` → **404** (not 403 — locked
  decision, hides existence of tasks the caller has no visibility into).
- If task truly does not exist → also 404, same shape. The two cases must be indistinguishable
  in the response.

### GET /api/v1/tasks
- Requires: `task:read:own` OR `task:read:any`.
- Query params: `page` (default 1, min 1), `limit` (default 10, max 100), `status` (optional,
  validated against enum, 400 if invalid), `ownerId` (optional).
- If caller only has `:own`: results are forced to `ownerId = req.user.id` regardless of any
  `ownerId` query param supplied — silently overridden, not an error.
- If caller has `:any`: `ownerId` filter honored if present; if absent, returns all tasks.
- Response: `{ data: Task[], meta: { page, limit, total, totalPages } }`
- `totalPages` is always at least 1, even when `total` is 0 — "page 1 of 0" isn't a meaningful
  state, so an empty result set is reported as page 1 of 1. Same rule applies to `GET
  /api/v1/users`'s `meta`.
- Default sort: `createdAt DESC`.

### PATCH /api/v1/tasks/:id
- Requires: `task:update:own` OR `task:update:any`, same ownership gate as GET (404 if
  unauthorized-and-not-owner).
- Partial update body: any subset of `{ title, description, status, dueDate, ownerId }`, plus a
  required `version` (see below).
- `ownerId` field itself is only editable by a caller with `task:update:any`.
- Success → `200`, emits `task.updated` WebSocket event.
- Not in the original locked contract, added with explicit sign-off for optimistic concurrency:
  `version` is required in the body and must be the exact value last read from a GET/list/
  create/update response for this task. A stale `version` → `409 Conflict`, never a silent
  overwrite. Every successful update increments `version` by 1.

### DELETE /api/v1/tasks/:id
- Requires: `task:delete:own` OR `task:delete:any`, same ownership gate.
- Soft delete: sets `deletedAt` on the row rather than removing it. A soft-deleted task is
  excluded from `GET /tasks` and 404s from `GET/PATCH/DELETE /tasks/:id` — indistinguishable
  from a hard-deleted one to any API caller. `deletedAt` itself is never present in any Task
  response body; there is no restore/undelete endpoint.
- Success → `204`, emits `task.deleted` WebSocket event.

---

## 5a. AI-Assisted Task Polish — Endpoint (Bonus, optional)

Not in the original locked contract. Added with explicit sign-off to address the take-home
assignment's "AI/LLM integration" bonus item. Purely a stateless text-formatting helper — it
never reads, writes, or references a specific Task row. The client still owns deciding
whether to keep the result and must submit it via the normal `POST`/`PATCH` flow above; this
endpoint has no side effects of its own.

### POST /api/v1/tasks/magic-polish
- Requires: `task:create` OR `task:update:own` OR `task:update:any` — any caller who can write a
  task in some capacity may use this to draft one. **Deliberate design decision, flagged rather
  than silently assumed**: there is no separate permission key for this (e.g. no
  `task:ai-polish`) — it's treated as a drafting aid to an existing write action, not an
  independent business capability. Reconsider this if per-role AI-usage control is ever wanted
  independently of create/update access.
- Body: `{ title: string, description?: string }` — the exact same length limits as Task's own
  `title` (required, ≤200 chars) and `description` (optional, ≤2000 chars), so a polished result
  can always be resubmitted through create/update without hitting a different limit.
- Response: `{ title: string, description: string }`. `description` is always present even if
  the request omitted one — the model is instructed to write one concise sentence restating the
  title rather than invent scope that wasn't provided.
- The model's output is re-validated against the same field-length limits as the request before
  it is ever returned to a client — an upstream LLM is treated as untrusted external input, not
  a shortcut around the limits a human-submitted body must satisfy.
- If the upstream call fails, times out (10s), or returns something that fails that
  re-validation, the response is `503 { error: "Service Unavailable" }` — never a raw upstream
  error or stack trace.
- Rate-limited **per authenticated user**, not per IP (contrast with the auth endpoints) — the
  resource being protected is Gemini API spend, not a login-guessing surface:
  `MAGIC_POLISH_RATE_LIMIT_MAX_ATTEMPTS` per `MAGIC_POLISH_RATE_LIMIT_WINDOW_MS` (default 20 per
  15 minutes) → `429` beyond that.
- Requires `GEMINI_API_KEY` to be configured server-side (a free-tier key from
  https://aistudio.google.com/apikey). If it isn't set, every call returns `503` rather than the
  server failing to boot — the feature is genuinely optional, not a hard dependency of the app.
- Does not persist anything and does not emit a WebSocket event.
- Never returns, logs, or otherwise exposes the Gemini API key; the frontend never receives it —
  every call to Gemini is made server-side only.

---

## 6. Real-Time (WebSocket) — Contract

- Transport: Socket.io.
- Auth: access token passed via the Socket.io handshake `auth` field — never as a query
  string param (avoids leaking tokens into server access logs).
- On successful handshake, server joins the socket to:
  - `user:{userId}` — always
  - `permission:task:read:any` — only if the user's effective permissions include
    `task:read:any` at connection time
- Events emitted server → client, identical payload shape for all three:
  ```
  { event: "task.created" | "task.updated" | "task.deleted", task: { ...Task } }
  ```
- Emission targets: `user:{task.ownerId}` room AND `permission:task:read:any` room (so the
  owner's other open sessions and any admin-scoped viewer both receive it; unrelated users
  receive nothing).
- Client behavior: on any event, invalidate the relevant query cache key(s) — task list and,
  if currently viewing that task's detail page, the detail query too. On reconnect, re-fetch
  the current view as a safety net for any events missed while disconnected.
- Not in the original locked contract, added from a security review finding: a handshake's
  access token is otherwise only checked once, at connect time, so a revoked session would
  keep receiving events for up to its remaining 15-minute lifetime. `POST /auth/logout-all`
  and `POST /api/v1/users/:id/logout-all` now also force-disconnect every open socket in that
  user's `user:{userId}` room, immediately, in addition to revoking the Redis-backed refresh
  sessions.

---

## 7. Validation & Error Handling — Contract

Single error response shape, used everywhere:
```
{ "statusCode": number, "error": string, "message": string | string[] }
```

Status code usage:
- `400` — validation failure (malformed body, invalid enum value, bad pagination params)
- `401` — missing / invalid / expired access token
- `403` — authenticated, but the endpoint itself requires a permission the caller holds
  none of (e.g. hitting `/api/v1/roles` with zero admin-type permissions). Reserved for
  "no access to this endpoint at all," not resource-level ownership.
- `404` — resource does not exist, OR caller lacks `:any` and isn't the owner (masked as
  not-found per the locked decision in Section 5)
- `409` — conflict (duplicate email)
- `413` — request body over the 16kb JSON size limit (`express.json({ limit })` in `app.ts`)
- `429` — too many requests to `/auth/login` or `/auth/register` from the same IP within the
  configured window (`AUTH_RATE_LIMIT_MAX_ATTEMPTS` / `AUTH_RATE_LIMIT_WINDOW_MS`, default 10
  per 15 minutes), Redis-backed so the limit holds across instances; the same shape also applies
  per-user to `POST /tasks/magic-polish` (§5a)
- `500` — unhandled server error; logged server-side with full detail, client receives only
  a generic message, never a stack trace or internal error string
- `503` — `POST /tasks/magic-polish` only (§5a): the AI polish feature isn't configured, or the
  upstream call failed/timed out/returned something invalid. Never a raw upstream error.

---

## 8. Locked Assumptions (do not silently change any of these)

1. Ownership-check failures return `404`, not `403`.
2. Refresh tokens are opaque random strings in httpOnly cookies, Redis-backed, rotating on
   every use, with reuse-detection triggering full session revocation.
3. Access tokens carry no permission data — permissions are always resolved server-side.
4. Permissions are a fixed, code-defined catalog; only role↔permission and user↔role /
   user↔permission assignments are admin-configurable.
5. DENY always overrides GRANT when both apply to the same permission for the same user.
6. Past due dates are allowed on task creation/update.
7. Tasks are soft-deleted (`deletedAt`), never exposed in any API response and indistinguishable
   from a hard delete to any caller — see §5 DELETE. (Corrected: this line previously read
   "hard-deleted, no soft-delete in v1", which contradicted §1's Task entity and §5's DELETE
   endpoint, both of which already documented soft-delete correctly.)
8. Registration always assigns the `USER` role; role is never client-controlled.
9. Admin permission/role management has a full frontend UI (guaranteed scope, not a
   stretch goal) in addition to being API-accessible.