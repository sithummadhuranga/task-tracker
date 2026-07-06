# CLAUDE.md — Instructions for Claude Code working in this repository

This file defines HOW to build. For WHAT to build, always defer to `docs/FEATURES_AND_API.md`
(exact contracts) and `docs/ARCHITECTURE.md` (structure/layering). Do not duplicate their
content here — if there's ever a conflict, those two files win.

## 0. Non-negotiable ground rules

1. Never invent an endpoint, field, permission key, or behavior that isn't in
   `docs/FEATURES_AND_API.md`. If something needed isn't specified there, stop and ask
   instead of guessing.
2. Never add a dependency that isn't already named in `docs/ARCHITECTURE.md` without
   flagging it first and explaining why it's needed.
3. Never silently resolve an ambiguity by picking whichever option is easiest to code.
   Flag it explicitly.
4. Follow the exact layering in `docs/ARCHITECTURE.md` (`routes → controller → service →
   repository → Prisma`). No skipping layers, no controller calling Prisma directly, no
   business logic in routes.

## 1. Comments — hard rules

- Comments explain **why**, never **what**. Code should be self-explanatory through naming;
  a comment that restates the function/variable name in prose is forbidden.
- **No emoji, anywhere** — not in comments, not in commit messages, not in log output, not
  in console output, not in README badges beyond standard shields.io build-status badges.
- No banner/section comments (`// ============ SECTION ============`). Split into a new
  file or function instead if a file feels like it needs visual sectioning.
- No commented-out dead code left in a commit. Delete it — git history preserves it.
- Acceptable comment, as an example of the bar:
  `// DENY overrides GRANT here by design — see docs/FEATURES_AND_API.md §2 (fail closed)`
- Unacceptable comment, as an example of the bar:
  `// This function creates a task` directly above `function createTask(...)`

## 2. Naming conventions

- `camelCase` for variables and functions, `PascalCase` for types/interfaces/classes,
  `SCREAMING_SNAKE_CASE` for true constants and enum-like literal unions.
- No abbreviations beyond the Express convention of `req`/`res`/`next`. Do not abbreviate
  domain words: `permission`, not `perm`; `task`, not `tsk`; `user`, not `usr`.
- Boolean variables and functions are prefixed `is`/`has`/`can` (`isOwner`, `hasPermission`,
  `canEditTask`).
- File names: `kebab-case.ts` for files, matching the primary export's purpose
  (`tasks.service.ts`, not `service.ts` or `TasksService.ts`).

## 3. SOLID, applied concretely (not as theory)

- **Single Responsibility**: one service method does one thing. If a service method both
  validates business rules AND formats a response, split it — formatting belongs in the
  controller.
- **Open/Closed**: new permission checks are added by registering a new permission key in
  the catalog and using `requirePermission('<key>')` on a route — never by adding an
  `if (user.role === 'ADMIN')` branch inside existing business logic.
- **Liskov / Interface Segregation**: repository interfaces expose only the methods a
  service actually needs — no fat "god repository" with every possible query method used
  by only one caller.
- **Dependency Inversion**: services depend on repository *interfaces*, injected via
  constructor, never on the concrete Prisma client directly. This is what makes unit tests
  possible without a real database.

## 4. Size limits (objective triggers, not guidelines to eyeball)

- Max ~300 lines per file. If a file grows past this, it's a signal to split by
  responsibility, not to keep appending.
- Max ~40 lines per function. Extract a helper if you cross this.
- Max 4 parameters per function; beyond that, pass a single options object.

## 5. Error handling

- One `AppError` base class with subclasses: `ValidationError` (400), `UnauthorizedError`
  (401), `ForbiddenError` (403), `NotFoundError` (404), `ConflictError` (409).
- Never `throw` a raw string or a plain `Error`. Never swallow a caught error silently
  (empty catch block is forbidden).
- The global error-handling middleware is the only place that shapes the final HTTP error
  response — services and controllers throw typed errors and let it handle formatting.

## 6. Validation

- All request validation via Zod schemas from `packages/shared-types` (or backend-local
  schemas if the shape is backend-only, e.g. pagination query params).
- Validation happens in middleware, before the controller method runs — controllers never
  manually check `if (!body.title)`.

## 7. Testing — required, not optional

- Every new service method ships with a corresponding unit test in the same commit —
  mocked repository, no real DB.
- Every new endpoint ships with at least one e2e test (happy path) and one negative test
  (the relevant 401/403/404/400 case) in the same commit.
- Do not chase 100% coverage on trivial code (simple DTOs, pure config). Do chase full
  coverage on: permission resolution logic, ownership checks, RBAC boundary cases (role-
  derived vs. direct-override, deny-wins), auth flows (including refresh rotation and
  reuse detection).

## 8. ESLint / Prettier

- `@typescript-eslint` strict + recommended configs, applied to both apps via the shared
  root config. `strict` here means: no implicit `any`, no unused variables, no
  non-null-assertion without justification, exhaustive switch/case on unions (e.g. Task
  status, Permission effect) enforced at compile time.
- Prettier for formatting only — never hand-format to fight Prettier's output.
- Lint must pass with zero warnings before a task is considered complete, not just zero
  errors.

## 9. Git commit conventions

- Conventional Commits: `feat:`, `fix:`, `test:`, `chore:`, `docs:`, `refactor:`, each with
  a concise, factual description — no vague messages like `fix stuff` or `updates`.
- One logical change per commit. A commit that adds an endpoint AND fixes an unrelated bug
  should be two commits.

## 10. When in doubt

Re-read `docs/FEATURES_AND_API.md` first. If the answer still isn't there, ask rather than
guess — a wrong assumption compounds across every layer built on top of it.