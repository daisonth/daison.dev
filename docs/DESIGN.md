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

### Dark mode

Light ink on dark paper — the same three roles, not a fourth palette.

| Name  | Hex       | vs. light mode                                   |
| ----- | --------- | ------------------------------------------------- |
| Paper | `#121212` | Near-black, not stark `#000` (same reasoning as light paper avoiding stark `#fff`). |
| Ink   | `#e8e6e2` | Warm off-white, not pure `#fff` — easier to read for long stretches, less halation. |
| Red   | `#ff5c5c` | Brightened from `#c81a1a` — the light-mode red is only ~3.3:1 on a dark background, below AA; this is ~5.8:1. |

Three states, in priority order: an explicit choice (`data-theme="light"` or
`"dark"` on `<html>`, set by `ThemeToggle.astro`, persisted in
`localStorage`) beats system preference (`prefers-color-scheme: dark`)
beats the light-mode defaults on bare `:root`. Applied before first paint
by an inline script in `BaseLayout.astro`'s `<head>` — the same
anti-flash technique as the old focus-mode script, for the same reason:
without it, a dark-mode visitor sees a flash of the light theme on every
load.

**Why this re-themes the whole site from three token overrides, with zero
per-component dark-mode CSS**: every color everywhere else in this
codebase is already expressed as `var(--color-ink)` / `var(--color-red)`
(or a `color-mix()` of them) rather than a literal hex — Tailwind's
generated utilities (`.text-ink`, `.bg-paper`, …) reference the custom
property by name, not an inlined value. Redefine the three tokens and
every utility that uses them picks up the new value automatically. If you
ever catch yourself reaching for a literal hex in a component instead of
one of these tokens or `currentColor` (icons already inherit via
`currentColor`, which is why they don't need a line of dark-mode code
either), that component will silently break in dark mode — there's no
test that catches this, only the rule.

The override block in `global.css` is **deliberately unlayered** (not
inside any `@layer`), same mechanism as the fullscreen overlay bug
described below under "Fullscreen" — Tailwind's `@theme` compiles into
`@layer theme`, and an unlayered rule always outranks every layer
regardless of specificity or source order. This is that trick used on
purpose instead of fought by accident.

**The one thing that isn't a simple color swap**: the paper grain. The
same noise texture reads dramatically grainier on a dark background than
a light one — it's a perceptual effect (noise shows up far more in
shadows than highlights), not a color one, so it needed its own
separately-dampened dark variant (`--grain` token, lower opacity baked
into the SVG) rather than inheriting the light version unchanged. Found
by actually looking at it in a browser, not by reasoning about CSS in the
abstract — the first version shipped was badly broken (looked like TV
static) despite being "correct" by the color-token logic above.

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
- `src/components/islands/` — Svelte components that own real client-side
  state (`Calculator.svelte`). Only things that genuinely need
  interactivity live here.
- Build in Astro by default (zero JS). Reach for a Svelte island only when a
  component needs client-side interactivity or owns animation state.

### Tools: the app-picker grid

`/tools` is a grid of square icon tiles (`ToolTile.astro`) — tap one to open
it, like picking an app off a home screen, deliberately reinterpreted without
rounded corners or gradients to stay inside the 3-color system. Rules for
adding a tool here:

- **Icon**: a hand-drawn inline SVG (no icon library/font — keeps the
  dependency list at zero and the look consistent), `viewBox="0 0 24 24"`,
  `stroke="currentColor"` `stroke-width="1.5"`, `fill="none"` except small
  filled dots/accents. It should read clearly at ~28px.
- **Not yet built**: pass `href={null}` and `status="planned"` — renders
  dimmed and inert rather than a dead link. Don't invent a route that
  doesn't work yet.
- **Where the tool lives**: see the "Tool scope split" note at the top of
  the root `CLAUDE.md` before adding a new one.

## Fullscreen

Not every tool needs this — a calculator or a short shopping list is
already a good size; a JSON/XML formatter genuinely benefits from more
room when pasting a large payload. So fullscreen is built **into the tool
component that needs it** (`FormatterTool.svelte`), not as a site-wide
pattern every tool page has to carry or opt out of.

- It's an in-page overlay (`position: fixed; inset: 0`), not the browser's
  native Fullscreen API — no permission prompt, no OS chrome side effects,
  works identically everywhere. The toggle button lives inside the tool's
  own button row (next to format/minify/copy/clear), never floating over
  the page — the user is maximizing *this tool*, not the browser tab.
- A small header inside the overlay names the tool ("JSON formatter" /
  "XML formatter") — with the site nav hidden behind the overlay, there
  has to be *something* identifying what you're looking at.
- The overlay carries the `.paper` texture class itself (plus an opaque
  `bg-paper` to actually hide what's behind it) rather than appearing as a
  flat white sheet — it should still look like this site, not a generic
  modal.
- **The overlay is portaled to a direct child of `<body>`** via a tiny
  `use:portal` action (`document.body.appendChild(node)` on mount, `.remove()`
  on destroy) instead of rendering in place. This isn't a style choice —
  without it, the footer visibly bled through the middle of the fullscreen
  overlay. `BaseLayout`'s `<main>` has `relative z-10`, which makes it its
  own stacking context; a z-index set on something *nested inside* main is
  only ever compared against other things inside that same context, so it
  can never outrank a sibling stacking context like `<footer>` (also
  `relative z-10`), no matter how high the number is — footer comes later
  in DOM order so it wins the tie and paints on top of all of main,
  overlay included. Portaling to `<body>` puts the overlay in the same
  flat comparison as header/main/footer, where z-index finally does what
  it looks like it should. If you add fullscreen to another tool, reuse
  this pattern — don't just bump the z-index higher, it won't help.
- Layout is a flex column filling the viewport: a flexible editor row on
  top, the status line + button row (which includes the toggle itself)
  pinned at the bottom simply by being the last flex child — nothing needs
  `position: sticky` or manual height math for "always visible," it falls
  out of the flex layout.
- The editor row adds a line-number gutter (a plain synced-scroll `<div>`,
  not a code-editor dependency) and the textarea switches to
  `white-space: pre` with horizontal scroll instead of soft-wrapping. This
  is the part that actually requires unwrapped lines: a wrapped long line
  would make one logical line span multiple visual rows, breaking the
  one-number-per-row gutter alignment.
- Esc exits fullscreen (matches user expectation even without the native
  Fullscreen API), and body scroll is locked while it's open since the
  overlay already fills the viewport on its own.
- **Don't build this as reusable global CSS keyed to a shared class.** An
  earlier version of this tried exactly that (a `.focus-mode` class on
  `<html>` with override rules in `global.css`) and silently lost a
  cascade-layer fight: Tailwind v4 emits utilities inside `@layer
  utilities`, declared *after* `@layer components` — and layer order beats
  selector specificity entirely, so a `.max-w-2xl` utility always won
  regardless of how specific the override selector was. Doing the layout
  switch via Svelte's own reactive classes (as `FormatterTool.svelte` does)
  sidesteps the cascade entirely: there's no override, just a different set
  of classes applied to begin with.

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
