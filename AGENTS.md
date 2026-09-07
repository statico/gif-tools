# AGENTS.md — statico's GIF tools

## Overview

statico's GIF tools is a static, client-side GIF toolkit, served at
gif.statico.io. Every transformation runs in the visitor's browser through
WebAssembly builds of ffmpeg, gifsicle and ImageMagick, or through the Canvas
2D API. No file is ever uploaded, and there is no API to call.

The site is a Next.js App Router project exported to static HTML
(`output: "export"`) and hosted on Cloudflare Pages.

## Installation

```bash
pnpm install
pnpm dev        # http://localhost:3000
```

pnpm is the package manager (pinned by `packageManager` in `package.json`).
`pnpm-workspace.yaml` sets `minimumReleaseAge`, so a release younger than a
week will not install.

`predev` and `prebuild` copy the WebAssembly binaries out of `node_modules`
into `public/` (`scripts/copy-wasm.mjs`), so they are served same-origin.
`public/ffmpeg/` and `public/magick/` are generated and git-ignored.

## Usage

Every tool is a page: open `/<slug>/`, drop in a file, adjust the controls,
download the result. Nothing is uploaded and there is no API. The slug list
lives in `src/lib/tools.ts` and is mirrored at `/llms.txt` and `/sitemap.md`.

## Commands

| Command           | What it does                                                                           |
| ----------------- | -------------------------------------------------------------------------------------- |
| `pnpm dev`        | Dev server on port 3000.                                                               |
| `pnpm build`      | Static export to `out/`, then generates the agent files.                               |
| `pnpm start`      | Serves the built `out/` directory.                                                     |
| `pnpm test`       | Playwright end-to-end tests.                                                           |
| `pnpm typecheck`  | Type check.                                                                            |
| `pnpm run deploy` | Build and upload to Cloudflare Pages. `run` is required: pnpm has a built-in `deploy`. |

## Architecture

```
src/lib/tools.ts        The tool registry. Single source of truth.
src/lib/engines/        ffmpeg, gifsicle, ImageMagick and canvas GIF encoding.
src/lib/history.ts      localStorage index + IndexedDB blobs.
src/components/         ToolShell (the shared tool contract) and smui UI.
src/app/<slug>/         One directory per tool: page.tsx + client.tsx.
scripts/                Build-time wasm copying and agent-file generation.
```

`src/lib/tools.ts` drives the navigation, the home page, every page's SEO
metadata, `sitemap.xml`, `llms.txt` and the Markdown mirrors. Adding a tool
means adding a registry entry and a route directory — nothing else needs
touching.

Each route is split in two so that static pages keep real metadata:
`page.tsx` is a server component that exports `metadata` and renders
`<ToolPage slug="…">`; `client.tsx` is the `"use client"` body that plugs into
`ToolShell`.

`ToolShell` owns the file input, preview, progress, error display, filename
field, download button and history write. A tool body receives
`{ file, setBusy, setProgress, setError, publish }` and calls `publish()` with
its result. Tools should not reimplement any of that.

## Configuration

- `next.config.ts` — `output: "export"`, `trailingSlash: true` for Cloudflare Pages.
- `src/lib/site.ts` — canonical URL and site metadata.
- `src/lib/tools.ts` — the single source of truth for tools, nav, SEO and sitemaps.
- `public/_headers` — caching and content types on Cloudflare Pages.

## Conventions

- The visual theme is [smui](https://smui.statico.io) — Nord-inspired,
  monospace, **zero border radius**, uppercase labels with wide letter
  spacing, `lucide-react` icons and no emoji in the interface chrome.
- Light and dark mode are both first-class. Use the CSS custom properties
  (`text-foreground`, `bg-card`, `hsl(var(--smui-green))`); never hardcode a
  hex colour in the UI.
- Everything must work down to a 375px viewport.
- Every control needs a real label, every button an accessible name, and
  status regions must be announced with `aria-live`.
- Prefer the smallest thing that works. No abstraction gets built for one
  caller.

## Testing

Playwright drives a real browser against the built site:

```bash
pnpm build
pnpm test
```

The WebAssembly engines are large (the ffmpeg core alone is ~32MB), so tests
that exercise a real encode need generous timeouts.

## Deployment

Cloudflare Pages, building with `pnpm build` and publishing `out/`, on
Node 24 (pinned by `.node-version` — the postbuild imports `src/lib/tools.ts`
directly and needs native TypeScript support).
`public/_headers` sets the cache and content-type rules that get copied into
the export; the postbuild appends a canonical `Link` header for every Markdown
mirror. `functions/_middleware.js` is the one piece of server code: it serves
the `.md` mirror to clients that ask for `text/markdown`, and falls through to
the static asset on any error.

## Agent readability

Audited with [a14y.dev](https://a14y.dev): **100/100** site-wide and **94/100**
page-mode against scorecard 0.2.0 (`pnpm dlx a14y check <url> --mode site`). The two
page-mode failures are local-server artefacts — `npx serve` applies neither
`_headers` nor Pages Functions, so the canonical `Link` header and Markdown
content negotiation only take effect on Cloudflare Pages. Re-run against the
deployed URL to confirm.

`pnpm build` regenerates `llms.txt`, `index.md`, `sitemap.md`, a `.md`
mirror for every tool page, and a served copy of this file, all from the tool
registry (`scripts/gen-agent-files.mjs`). If you change a tool's name or
description, rebuild rather than editing the generated Markdown by hand.
