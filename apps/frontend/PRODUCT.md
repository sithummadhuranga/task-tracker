# Product

## Register

product

## Users

Individual contributors and admins managing shared work in a small team. Users log in daily to
create, update, and track tasks assigned to themselves or others; admins additionally manage
roles and permissions. Sessions are frequent and short — this is a tool people dip into between
other work, not a destination they browse. Desktop-first but must hold up on a laptop at
half-width and on mobile.

## Product Purpose

A task tracker with role-based access control and real-time updates. Success looks like: a new
user can register, sign in, and see their tasks with zero confusion about what's happening or
what to do next; an admin can tell at a glance who has access to what. The auth screens and the
signed-in shell are the first and most repeated impression of the product — they set the bar
for everything built on top of them.

## Brand Personality

Clean and professional, in the Linear / Notion register: calm, trustworthy, low-friction. Quiet
confidence rather than loud energy — the interface should feel like it respects the user's
time and gets out of the way of the work, not like it's trying to impress with effects.
Generous whitespace and soft depth (Notion/Vercel-dashboard feel) rather than harsh contrast.

## Anti-references

Explicitly rejected: the current implementation, described by the user as "completely black
and white, ugly as hell" — flat brutalist zinc/black/white with no depth, no accent color, and
no warmth. Avoid generic SaaS-template scaffolding (uniform card grids, gradient-text headings,
tiny uppercase eyebrows on every section) — this is app UI, not a landing page, so it should
never reach for those marketing patterns at all.

## Design Principles

- Depth over contrast: layered surface tones and soft shadows read as "designed," not just
  black-on-white or white-on-black.
- One accent, used with intent: a single confident accent color for primary actions and focus
  states, not sprinkled decoratively.
- Respect the task: motion and visual flourish support comprehension (what changed, what's
  next) — they never delay the user from getting to their tasks.
- Consistent under both themes: every token has a light and dark value from the start, even
  though dark ships as the default experience today.

## Accessibility & Inclusion

Standard WCAG AA: body text ≥4.5:1 contrast, large/bold text ≥3:1, visible focus rings on every
interactive element, `prefers-reduced-motion` alternative for every animation.
