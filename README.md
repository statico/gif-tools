# gif.statico.io

A GIF toolkit that runs entirely in your browser. It covers most of what
a hosted GIF editor does, plus a set of Slack emoji generators, with no backend: ffmpeg,
gifsicle and ImageMagick are compiled to WebAssembly and run in the page.

Nothing is uploaded. There is no API, no account and no server-side processing.

## Tools

**Convert** — video to GIF, GIF to MP4/WebM, GIF maker from images, format
conversion, frame splitting.

**Edit** — resize, crop, cut, speed, reverse and boomerang, rotate and flip,
captions, effects and colour adjustment.

**Optimize** — gifsicle GIF compression, still-image compression.

**Emoji** — intensifies, party parrot, the animated emoji effect pack, the
100-style number generator, and square text emoji for Slack.

## Development

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # static export to out/
npm test             # Playwright, against the built export
```

`predev`/`prebuild` copy the WebAssembly binaries from `node_modules` into
`public/`, so they are served same-origin. Those directories are generated and
git-ignored.

If npm fails with `EPERM` on `~/.npm`, the cache is not writable in your
sandbox — `.npmrc` redirects it, so run commands from the repo root.

## Deployment

Cloudflare Pages:

| Setting | Value |
|---|---|
| Build command | `npm run build` |
| Output directory | `out` |
| Node version | 24 (set by `.node-version`) |

Node 24 is not optional: the postbuild script imports `src/lib/tools.ts`
directly, which needs native TypeScript support. `.node-version` pins it for
Pages.

`public/_headers` sets caching for the WebAssembly binaries and the correct
content types for the Markdown mirrors, and is copied into the export. The
postbuild appends a canonical `Link` header for each Markdown mirror.

`functions/_middleware.js` deploys alongside the static export and serves the
`.md` mirror to clients that send `Accept: text/markdown`. It falls through to
the static asset on any error.

## Notes

The ffmpeg core is around 32MB and loads on demand, only on pages that need
it. The single-threaded build is used deliberately so the site needs no
`Cross-Origin-Opener-Policy` / `Cross-Origin-Embedder-Policy` headers and no
`SharedArrayBuffer`; the trade-off is encode speed.

See [AGENTS.md](./AGENTS.md) for architecture and conventions.
