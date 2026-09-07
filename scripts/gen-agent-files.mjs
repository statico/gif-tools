/**
 * Post-build: emit the agent-readability surface into out/.
 *
 * Everything here derives from src/lib/tools.ts so the site, the sitemap and
 * the markdown mirrors can never drift apart. Node 24 imports the .ts directly.
 */
import { writeFile, readFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const { TOOLS, CATEGORIES } = await import("../src/lib/tools.ts");
const { TERMS } = await import("../src/lib/glossary.ts");
const { SITE } = await import("../src/lib/site.ts");

const OUT = join(process.cwd(), "out");
const now = new Date().toISOString();
const ORDER = ["convert", "edit", "optimize", "emoji"];

const write = async (rel, body) => {
  const path = join(OUT, rel);
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, body, "utf8");
  console.log(`wrote out/${rel}`);
};

/* ── llms.txt ──────────────────────────────────────────────────────────── */
const llms = `# ${SITE.name}

> ${SITE.description}

Every tool runs client-side in WebAssembly. There is no API and no upload
endpoint: files are processed in the visitor's own browser and never sent
anywhere. The site is a static export, so every page below is a real HTML
document with its own metadata, and each has a Markdown mirror at the same
path with a \`.md\` extension.

## Tools

${ORDER.map(
  (cat) => `### ${CATEGORIES[cat].label} — ${CATEGORIES[cat].description}

${TOOLS.filter((t) => t.category === cat)
  .map((t) => `- [${t.name}](${SITE.url}/${t.slug}.md): ${t.description}`)
  .join("\n")}`,
).join("\n\n")}

## About

- [Home](${SITE.url}/index.md): the full tool index.
- [Sitemap](${SITE.url}/sitemap.md): every page on the site.
- [AGENTS.md](${SITE.url}/AGENTS.md): how this site is built and how to work on it.

## Engines

- ffmpeg (WebAssembly) — video and animation decoding, filtering and encoding.
- gifsicle (WebAssembly) — GIF-specific optimisation and palette reduction.
- ImageMagick (WebAssembly) — still-image conversion and compression.
- Canvas 2D plus gifenc — the emoji and text generators.

Last updated: ${now}
`;
await write("llms.txt", llms);

/* ── per-tool markdown mirrors ─────────────────────────────────────────── */
for (const t of TOOLS) {
  await write(
    `${t.slug}.md`,
    `---
title: "${t.title}"
description: "${t.description.replace(/"/g, '\\"')}"
url: "${SITE.url}/${t.slug}/"
category: "${t.category}"
last_updated: "${now}"
doc_version: "1"
---

# ${t.title}

${t.description}

## How it works

This tool runs entirely in your browser using ${t.engine.join(", ")} compiled to
WebAssembly (or the Canvas API, where listed). Your file is never uploaded — it is
read into memory, processed locally, and offered back to you as a download.

## Using it

1. Open ${SITE.url}/${t.slug}/
2. ${t.category === "emoji" && (t.slug === "number" || t.slug === "text-emoji") ? "Enter your text and pick a style." : "Choose a file, by drag and drop or the file picker."}
3. Adjust the settings. ${t.blurb}
4. Set the filename and download. Names are slugified so the result can be
   uploaded straight to Slack as a custom emoji.

Results are also saved to a per-browser history at ${SITE.url}/history/.

## Related

${TOOLS.filter((x) => x.category === t.category && x.slug !== t.slug)
  .map((x) => `- [${x.name}](${SITE.url}/${x.slug}.md): ${x.blurb}`)
  .join("\n")}

## Sitemap

- [Every page, grouped by section](${SITE.url}/sitemap.md)
- [XML sitemap](${SITE.url}/sitemap.xml)
- [Site overview for agents](${SITE.url}/llms.txt)
`,
  );
}

/* ── index.md ──────────────────────────────────────────────────────────── */
await write(
  "index.md",
  `---
title: "${SITE.title}"
description: "${SITE.description}"
url: "${SITE.url}/"
last_updated: "${now}"
doc_version: "1"
---

# ${SITE.title}

${SITE.description}

There is no account, no upload and no server-side processing. Every tool below is
a static page that loads a WebAssembly engine on demand and does the work in your
own browser. Results are kept in a local history so you can fetch them again, and
downloads are named so they can go straight into Slack as custom emoji.

${ORDER.map(
  (cat) => `## ${CATEGORIES[cat].label}

${CATEGORIES[cat].description}

${TOOLS.filter((t) => t.category === cat)
  .map((t) => `- [${t.name}](${SITE.url}/${t.slug}.md): ${t.description}`)
  .join("\n")}`,
).join("\n\n")}

## Sitemap

- [Every page, grouped by section](${SITE.url}/sitemap.md)
- [XML sitemap](${SITE.url}/sitemap.xml)
`,
);

/* ── sitemap.md ────────────────────────────────────────────────────────── */
await write(
  "sitemap.md",
  `---
title: "Sitemap — ${SITE.name}"
description: "Every page on ${SITE.name}, grouped by section."
url: "${SITE.url}/sitemap.md"
last_updated: "${now}"
doc_version: "1"
---

# Sitemap

## Site

- [Home](${SITE.url}/): the tool index.
- [History](${SITE.url}/history/): your local results (not indexed; per-browser).

${ORDER.map(
  (cat) => `## ${CATEGORIES[cat].label}

${TOOLS.filter((t) => t.category === cat)
  .map((t) => `- [${t.name}](${SITE.url}/${t.slug}/) ([markdown](${SITE.url}/${t.slug}.md)): ${t.blurb}`)
  .join("\n")}`,
).join("\n\n")}
`,
);

/* ── glossary.md and history.md ────────────────────────────────────────── */
await write(
  "glossary.md",
  `---
title: "GIF glossary — ${SITE.name}"
description: "Plain definitions of the terms these tools use."
url: "${SITE.url}/glossary.md"
last_updated: "${now}"
doc_version: "1"
---

# GIF glossary

The terms these tools use, defined once. Every setting on every page means one of
these things.

${TERMS.map(
  (t) =>
    `## ${t.term}\n\n${t.body}${
      t.see ? `\n\nSee [${TOOLS.find((x) => x.slug === t.see)?.name}](${SITE.url}/${t.see}.md).` : ""
    }`,
).join("\n\n")}

## Sitemap

- [Every page, grouped by section](${SITE.url}/sitemap.md)
`,
);

await write(
  "history.md",
  `---
title: "History — ${SITE.name}"
description: "Your recent results, stored in this browser only."
url: "${SITE.url}/history.md"
last_updated: "${now}"
doc_version: "1"
---

# History

Every result you generate is kept in this browser — the index in localStorage and
the files themselves in IndexedDB. Nothing is uploaded, so the list is per-browser
and per-device, and clearing site data clears it.

## What you can do here

- Download any past result again under its original filename.
- Delete a single entry, or clear the whole history.
- See which tool produced each file, and when.

## Sitemap

- [Every page, grouped by section](${SITE.url}/sitemap.md)
`,
);

/* ── AGENTS.md (served copy) ───────────────────────────────────────────── */
await write("AGENTS.md", await readFile(join(process.cwd(), "AGENTS.md"), "utf8"));

console.log(`\ngenerated agent files for ${TOOLS.length} tools`);

/* ── canonical Link headers for the markdown mirrors ───────────────────── */
// Cloudflare Pages reads out/_headers; one rule per mirror points agents at
// the HTML page each .md duplicates.
const mirrors = [
  ...TOOLS.map((t) => [`/${t.slug}.md`, `${SITE.url}/${t.slug}/`]),
  ["/index.md", `${SITE.url}/`],
  ["/glossary.md", `${SITE.url}/glossary/`],
  ["/history.md", `${SITE.url}/history/`],
  ["/sitemap.md", `${SITE.url}/sitemap.md`],
  ["/AGENTS.md", `${SITE.url}/AGENTS.md`],
];
const headersPath = join(OUT, "_headers");
const existing = await readFile(headersPath, "utf8");
await writeFile(
  headersPath,
  `${existing.trimEnd()}\n\n${mirrors
    .map(([path, canonical]) => `${path}\n  Link: <${canonical}>; rel="canonical"`)
    .join("\n\n")}\n`,
  "utf8",
);
console.log(`added canonical Link headers for ${mirrors.length} markdown mirrors`);
