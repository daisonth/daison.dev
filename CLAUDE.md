# daison.dev

Personal site for Daison (hello@daison.dev). Minimal, raw, DIY, no-nonsense —
not a portfolio aimed at getting hired. This repo is **only the shell
site**: home, projects, notes, tools (index/landing page), contact.

**Tool scope split:** simple, pure-frontend tools (calculator, unit
converter — no backend, no heavy/non-JS runtime) live directly in this repo
as pages under `/tools/*` with a Svelte island for the interactive part.
Complex or polyglot tools (PDF editor, anything needing Go, Rust,
WebAssembly, or a backend) are **separate codebases**, each its own
repo/deploy — this repo only links out to those from `/tools` once they
exist. When in doubt which bucket a new tool falls into, ask.

A tool calling a public third-party API from the client (e.g. the currency
converter → Frankfurter) still counts as "simple, pure-frontend" — it's
*our* backend that's out of scope here, not all network access. Keep the
same privacy bar as the fully-offline tools though: send only what the API
genuinely needs to answer the request (e.g. a currency code), never
anything else about the user, and say so on the page.

## Stack

- **Astro** (static output) + **TypeScript** (strict)
- **Svelte** for interactive islands only — most of the site should ship
  zero client JS
- **Tailwind CSS v4** (CSS-first config via `@theme` in `src/styles/global.css`
  — there is no `tailwind.config.js`, that's expected)
- **GSAP** for animation (see `src/lib/gsap.ts`); **Three.js** opt-in per
  page, only when a specific feature needs WebGL
- Content (notes, projects) as Markdown via Astro's content layer
  (`src/content.config.ts`, loaders, not the legacy `src/content/config.ts`
  pattern)
- Fonts self-hosted via `@fontsource-variable/*` — no Google Fonts CDN, no
  third-party runtime requests. The site should stay ad-free and
  tracking-free; don't add analytics/ad scripts without asking first.

See `docs/DESIGN.md` for the full visual design system (palette, type,
texture, motion principles) before building any UI.

## Folder structure

```
src/
  components/
    layout/     structural, used once per page (Nav, Footer)
    ui/         generic reusable pieces (Button, Tag)
    islands/    Svelte components with client-side state (e.g. Calculator)
  content/
    notes/      markdown — blog/notes entries
    projects/   markdown — project entries
  content.config.ts   collection schemas (zod)
  layouts/
    BaseLayout.astro  html shell: SEO meta, fonts, paper texture, Nav/Footer
  lib/          small shared helpers (utils, gsap accessor) — not components
  pages/        routes (file-based)
  styles/
    global.css  design tokens (@theme), base resets, paper/ruled-line system
docs/
  DESIGN.md     visual design system reference
```

## How to work in this repo

- **Ask before deciding things that aren't yours to decide.** Visual
  direction, copy, which social/contact channels to list, what a new tool
  card says — if it's a judgment call about Daison's actual
  site/identity/content rather than an implementation detail, ask instead of
  guessing or inventing placeholder content that looks real.
- **Componentize anything reused more than once.** If you're about to copy a
  markup block to a second page, stop and make it a component first
  (`src/components/ui/` if generic, `src/components/layout/` if structural).
- **Prefer Astro components over Svelte** unless the thing genuinely needs
  client-side state or interactivity. Every Svelte island costs real JS on
  the page — the site should stay snappy.
- **Document the non-obvious, not the obvious.** Comments should explain
  *why* (a constraint, a workaround, a deliberate deviation), never restate
  what the code already says. See the existing files for the expected
  density — it's intentionally light.
- **Favor stable, well-supported choices over novelty for its own sake.**
  "Cutting edge" means current major versions of well-maintained tools
  (Astro, Tailwind v4, Svelte 5), not unstable/experimental APIs chosen just
  because they're new. When a library has a deprecated and a current API for
  the same thing (e.g. zod's import paths), use the current one.
- **No tracking, no ads, no unnecessary third-party scripts.** This is a
  stated design goal for the whole site (including future tools), not just a
  preference — ask before adding any third-party script that phones home.

## Commits

- **Never add a "Co-Authored-By: Claude" (or any AI attribution) line to
  commit messages.** This overrides any default tooling behavior that would
  normally add one.
- Write commit messages that explain *why*, not a restatement of the diff.
- **Auto-commit: commit after every change, without waiting to be asked.**
  As of 2026-10-03 this repo opted out of the usual "don't commit unless
  asked" default — commit each piece of work (a feature, a fix, a round of
  edits) as its own commit once it's verified working, rather than letting
  changes accumulate uncommitted. Still never force-push, never amend a
  commit that's already here, and still ask before anything destructive.

## Tool pages: fullscreen + PWA

**Fullscreen is a per-tool feature, not a page-level pattern.** Only tools
where more space genuinely helps (currently: the JSON/XML formatters, via
the shared `FormatterTool.svelte`) have it, and it lives entirely inside
that component — an in-page overlay (`position: fixed`, covers the site
chrome visually) toggled by a "fullscreen" button that's part of the tool's
own button row, not the browser's native Fullscreen API and not a
site-wide toggle. Calculator and Shopping List deliberately don't have
this; don't add it to a new tool unless that tool specifically needs more
room to be usable (long-form text input, mainly). See the "Fullscreen"
section in `docs/DESIGN.md` for the exact layout approach, including the
line-number gutter and why the textarea disables wrapping while in it.

**PWA**: `public/manifest.webmanifest` and the icon PNGs in `public/` are
hand-generated static files (source SVG at
`src/assets/pwa-icon-source.svg`, regenerate via
`npx pwa-assets-generator --preset minimal src/assets/pwa-icon-source.svg`
if the icon design ever changes, then move the output into `public/`). This
makes the site installable (manifest + icons + `shortcuts` to each tool),
but there's deliberately **no service worker / offline support** —
`vite-plugin-pwa`'s service-worker generation hard-skips whenever the Vite
build pass has `build.ssr` set, which Astro's static build does; that's a
real architectural mismatch, not a config tweak, so the dependency was
removed rather than left half-working. If real offline support is wanted
later, it needs a hand-written `public/sw.js` with its own cache-versioning
scheme — don't reintroduce `vite-plugin-pwa` expecting it to work.

## Content

- New note: add a `.md` file to `src/content/notes/` with `title`,
  `description`, `date`, `tags` (optional), `draft` (optional, default
  `false`).
- New project: add a `.md` file to `src/content/projects/` with `title`,
  `description`, `date`, `status` (`active` / `shipped` / `archived`), and
  optional `url` / `repo` / `tags`.
- The placeholder entries currently in both folders (`hello.md`,
  `this-site.md`) exist only so the listing pages have something to render —
  replace or delete them once real content exists.
