// Copy wasm engine assets into public/ so they're served same-origin.
// Same-origin matters: ffmpeg.wasm spawns a worker, and CDN loading would
// break both offline use and any future COEP tightening.
import { mkdir, copyFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const nm = join(process.cwd(), "node_modules");

const jobs = [
  ["@ffmpeg/core/dist/esm/ffmpeg-core.js", "public/ffmpeg/ffmpeg-core.js"],
  ["@ffmpeg/core/dist/esm/ffmpeg-core.wasm", "public/ffmpeg/ffmpeg-core.wasm"],
  ["@imagemagick/magick-wasm/dist/x64/magick.wasm", "public/magick/magick.wasm"],
];

for (const [rel, dest] of jobs) {
  const out = join(process.cwd(), dest);
  await mkdir(dirname(out), { recursive: true });
  await copyFile(join(nm, rel), out);
  console.log(`copied ${dest}`);
}
