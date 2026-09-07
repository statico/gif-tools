# statico's GIF tools

> [!NOTE]
> Every line of this project — the site, the tests and the documentation — was
> written by [Claude Code](https://claude.com/claude-code).

A GIF toolkit that runs entirely in your browser: convert, resize, crop, cut,
optimize and caption GIFs, and build Slack emoji. ffmpeg, gifsicle and
ImageMagick are compiled to WebAssembly and run in the page.

Nothing is uploaded. There is no API, no account and no server-side processing.

Live at [gif.statico.io](https://gif.statico.io).

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
pnpm install
pnpm dev            # http://localhost:3000
pnpm build          # static export to out/
pnpm test           # Playwright, against the built export
pnpm typecheck
```

`predev`/`prebuild` copy the WebAssembly binaries out of `node_modules` into
`public/`, so they are served same-origin. Nothing is vendored: ffmpeg,
gifsicle and ImageMagick all arrive as npm packages, and `public/ffmpeg/` and
`public/magick/` are generated and git-ignored.

`pnpm-workspace.yaml` sets `minimumReleaseAge`, so `pnpm install` refuses any
release younger than a week.

## Deployment

Cloudflare Pages:

| Setting          | Value                       |
| ---------------- | --------------------------- |
| Build command    | `pnpm build`                |
| Output directory | `out`                       |
| Node version     | 24 (set by `.node-version`) |

Node 24 is not optional: the postbuild script imports `src/lib/tools.ts`
directly, which needs native TypeScript support.

To deploy from a checkout instead of from Git:

```bash
pnpm run deploy     # `run` is required: pnpm has its own `deploy` command
```

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

## License

MIT — see [LICENSE](./LICENSE).
