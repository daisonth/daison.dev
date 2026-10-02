# daison.dev

Personal site for Daison (hello@daison.dev). Minimal, raw, DIY, no-nonsense —
not a portfolio aimed at getting hired. This repo is **only the shell
site**: home, projects, notes, tools (index/landing page), contact.

Individual tools (PDF editor, URL shortener, mini-games, etc.) are **separate
codebases**, deliberately polyglot (Go, Rust, WebAssembly, whatever fits the
tool), each its own repo/deploy. This repo only links out to them from
`/tools` once they exist. Don't pull tool implementations into this repo.

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
- Don't commit unless explicitly asked to.

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
