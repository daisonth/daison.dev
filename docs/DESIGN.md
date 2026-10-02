# Design Guide

The site should look like it was made by one person with strong opinions, not
assembled from a template. Every rule below exists to protect that — when in
doubt, cut rather than add.

## Palette

Exactly three colors. No grays, no blues, no gradients beyond the texture
layer below.

| Name    | Token          | Hex       | Usage                                                   |
| ------- | -------------- | --------- | -------------------------------------------------------- |
| Paper   | `--color-paper` | `#fafaf8` | Background. Near-white, not stark `#fff`.                |
| Ink     | `--color-ink`   | `#111110` | Text, borders, icons. Near-black.                        |
| Red     | `--color-red`   | `#c81a1a` | Links, active states, accents. **Never** a large fill.   |

Red on paper is ~5.7:1 contrast — passes WCAG AA for normal text, so it's
safe to use for links and small text, not just decoration. Tailwind utilities
are generated directly from these tokens: `bg-paper`, `text-ink`, `border-red`,
`text-red/70`, etc. (defined in `src/styles/global.css` under `@theme`).

**Rule of thumb:** red marks *one* thing per view — the active nav link, a
hover state, a status tag. If more than one element is red at a time, that's
a sign something should be ink instead.

## Shape

No rounded corners, anywhere. Enforced globally in
`src/styles/global.css` (`@layer base`) rather than relied on per-component —
don't fight it with inline styles or arbitrary Tailwind values.

Borders are 1px solid `ink` at reduced opacity (`border-ink/15` for
structural dividers, `border-ink/30`+ for things that should read as
deliberate, like cards or tags). Depth comes from borders and spacing, never
box-shadow.

## Typography

One typeface, used for everything: **JetBrains Mono** (variable weight,
self-hosted via `@fontsource-variable/jetbrains-mono` — no external font
requests, no CDN dependency, no layout-shift risk from a third-party host).

A single monospace face across headings and body is a deliberate choice: it
reads as technical/DIY rather than "blog template," and it's legible at
small sizes for long-form notes. Don't introduce a second typeface for
headings — lean on size and weight (700/800) instead.

Body copy line-height is `2rem` (`--rule-gap`), matching the ruled-paper
background spacing exactly, so text baselines sit on the lines like real
notebook paper. If you change the base font size, update `--rule-gap` (and
the ruled-line `background-size`) together or the alignment breaks.

## Texture: the paper

Applied once, to `<body class="paper">` in `BaseLayout.astro`:

1. **Grain** — a tiled `feTurbulence` SVG noise filter, inlined as a data URI
   background (no image request, no asset to manage).
2. **Ruled lines** — a `repeating-linear-gradient` at 8% ink opacity, spaced
   `--rule-gap` apart.
3. **Margin line** — a fixed 1px red vertical rule at `3.5rem` from the left,
   styled on `.margin-line`, hidden below `40rem` viewport width. This is the
   one deliberate nod to literal "notebook paper" (legal-pad margin rule) and
   doubles as the site's most recognizable visual signature — don't remove it
   without a replacement idea that does the same job.

Both are pure CSS background layers — no DOM nodes, no paint cost beyond a
single composited layer, and they never conflict with content selection or
screen readers.

## Motion

GSAP is the animation engine (`src/lib/gsap.ts` exports a `getGsap()` helper
that registers `ScrollTrigger` exactly once — import from there, not `gsap`
directly, in any island that animates). Three.js is opt-in per page, only
when something genuinely needs WebGL — it is not part of the base bundle.

Principles, not yet fully implemented (animation work is deliberately
pending further direction — see root `CLAUDE.md`):

- **Restraint over coverage.** A handful of well-placed scroll reveals beat
  animating every element. On a sharp, minimal layout, excess motion reads
  as noise, not polish.
- **`prefers-reduced-motion` is respected globally** (see `global.css`) —
  any animation you add on top of that should still feel complete with
  motion effectively disabled; don't gate essential content behind it.
- Favor animating things that reinforce the paper/ink metaphor (e.g. a
  border or underline "drawing in") over generic fade/slide-up patterns.

## Components

- `src/components/ui/` — generic, reusable, no page-specific knowledge
  (`Button.astro`, `Tag.astro`). Keep variants to a minimum; a new variant
  should earn its place.
- `src/components/layout/` — structural, used once per page (`Nav.astro`,
  `Footer.astro`).
- Build in Astro by default (zero JS). Reach for a Svelte island only when a
  component needs client-side interactivity or owns animation state.

## Accessibility

Not optional, not a trend — it's part of "long-term supported." Minimum bar:

- All interactive states (hover, focus, active) must be visible without
  relying on color alone where practical.
- Maintain WCAG AA contrast for all text (the palette above is already
  verified; don't introduce lighter tints of ink for body text without
  re-checking contrast).
- Respect `prefers-reduced-motion` (already wired globally).
- Semantic HTML first — `<nav>`, `<main>`, `<article>`, `<footer>` are
  already in place in the layout and page templates; keep using them.
