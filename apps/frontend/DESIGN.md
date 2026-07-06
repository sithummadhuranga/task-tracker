# Design

## Theme strategy

Dark and light both defined as CSS custom properties from day one; dark ships as the default
experience today (no theme toggle in this build — `:root` carries the dark values directly,
`[data-theme="light"]` carries the overrides for whenever a toggle is added).

## Color strategy

**Restrained**: tinted neutral ramp + one primary accent used with intent, one secondary
accent reserved for status/attention only. Brand seed: `oklch(0.550 0.095 180)` (a quiet,
desaturated teal — "oxidized patina" read). Seed chroma < 0.10, so a subtly tinted neutral
ramp (not pure achromatic) is the correct application per the seed's own guidance.

## Tokens (OKLCH)

### Dark (default)

| Token | Value | Use |
|---|---|---|
| `--bg` | `oklch(0.14 0.008 180)` | App canvas |
| `--surface` | `oklch(0.20 0.010 180)` | Cards, panels, the auth form column |
| `--surface-2` | `oklch(0.25 0.012 180)` | Raised/hover state above `--surface` |
| `--border` | `oklch(0.32 0.014 180)` | Hairline borders, dividers |
| `--ink` | `oklch(0.94 0.006 180)` | Primary text — 7:1+ vs `--bg` |
| `--muted` | `oklch(0.68 0.012 180)` | Secondary text — 4.5:1+ vs `--bg` |
| `--primary` | `oklch(0.72 0.11 180)` | Primary actions, links, focus ring |
| `--primary-ink` | `oklch(0.99 0 0)` | Text/icons on `--primary` fill |
| `--accent` | `oklch(0.74 0.15 55)` | Status/attention only (e.g. due-soon, warnings) |
| `--accent-ink` | `oklch(0.99 0 0)` | Text/icons on `--accent` fill |
| `--danger` | `oklch(0.62 0.19 25)` | Destructive actions, error text |
| `--danger-ink` | `oklch(0.99 0 0)` | Text/icons on `--danger` fill |
| `--success` | `oklch(0.72 0.14 150)` | Success banners/badges |

### Light

| Token | Value |
|---|---|
| `--bg` | `oklch(1.000 0.000 0)` |
| `--surface` | `oklch(0.98 0.006 180)` |
| `--surface-2` | `oklch(0.95 0.008 180)` |
| `--border` | `oklch(0.90 0.008 180)` |
| `--ink` | `oklch(0.20 0.010 180)` |
| `--muted` | `oklch(0.46 0.012 180)` |
| `--primary` | `oklch(0.48 0.10 180)` |
| `--primary-ink` | `oklch(0.99 0 0)` |
| `--accent` | `oklch(0.60 0.16 55)` |
| `--accent-ink` | `oklch(0.99 0 0)` |
| `--danger` | `oklch(0.55 0.20 25)` |
| `--danger-ink` | `oklch(0.99 0 0)` |
| `--success` | `oklch(0.55 0.13 150)` |

Text-on-fill rule applied consistently: every saturated mid-luminance fill (`--primary`,
`--accent`, `--danger`) gets white/near-white text, never dark-on-saturated.

## Typography

Product register: one family, fixed rem scale, tighter ratio (~1.2) — no fluid/clamp sizing.

- Inter throughout — headings, labels, body, data. Headings weight 600, tight tracking
  (`-0.02em`), never gradient-clipped.
- Fixed scale: `0.75rem / 0.8125rem / 0.875rem / 1rem / 1.25rem / 1.5rem / 1.875rem`.
  Largest heading in this pass is 1.875rem (auth page title) — orients, doesn't perform.

## Layout & spacing

- Auth screens: two-column split on `lg+` (hero/brand column + form column), single column
  below `lg`. Hero column carries the brand personality; form column is the actual task.
- Signed-in shell: sticky header + generous vertical rhythm in the main content area (not
  cramped — this is the "airy" quality from the Notion/Vercel reference, delivered via spacing
  and layered surfaces rather than a light background).
- Cards used only where they're the right affordance (task rows); no nested cards.

## Motion

Product register: motion conveys state, not decoration; no orchestrated page-load sequences —
corrected from an earlier brand-register draft that over-choreographed entrances.

- Auth card: one subtle fade + 8px rise on mount, ~200ms, `ease-out`. No per-field stagger.
- HomePage: no entrance choreography on the task list. Motion is reserved for real state
  change — hover/press feedback, a task transitioning status, a row being added/removed later.
- All interactive states (hover/focus/active/disabled) transition in 120–180ms.
- Every animation has a `prefers-reduced-motion` fallback (instant/opacity-only).
- `motion` (Framer Motion successor) covers the one auth-card mount transition; `gsap` is kept
  installed for later real state-driven list changes but isn't used for page-load decoration.

## Components touched this pass

`AuthLayout`, `FormField`, `SubmitButton`, `FormBanner` (reintroduced for consistent
error/success styling), `LoginPage`, `RegisterPage`, `HomePage`.
