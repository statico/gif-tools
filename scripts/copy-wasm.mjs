// Copy wasm engine assets into public/ so they're served same-origin.
// Same-origin matters: ffmpeg.wasm spawns a worker, and CDN loading would
// break both offline use and any future COEP tightening.
//
// The ffmpeg worker needs patching. @ffmpeg/ffmpeg always spawns it with
// { type: "module" }, where importScripts() does not exist, and its fallback
// path is a webpack stub that throws "Cannot find module ..." instead of
// importing the core. Serving the worker ourselves lets us restore a real
// dynamic import, which a module worker supports natively.
import { mkdir, copyFile, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { gzipSync } from "node:zlib";

const nm = join(process.cwd(), "node_modules");

const jobs = [
  ["@ffmpeg/core/dist/esm/ffmpeg-core.js", "public/ffmpeg/ffmpeg-core.js"],
  // x86 (wasm32), not x64: initializeImageMagick() is the 32-bit glue — the
  // 64-bit build only links against initializeImageMagickx64.
  ["@imagemagick/magick-wasm/dist/x86/magick.wasm", "public/magick/magick.wasm"],
];

for (const [rel, dest] of jobs) {
  const out = join(process.cwd(), dest);
  await mkdir(dirname(out), { recursive: true });
  await copyFile(join(nm, rel), out);
  console.log(`copied ${dest}`);
}

// Cloudflare Pages rejects any file over 25 MiB and the core is 31, so it ships
// gzipped and the loader inflates it in the browser (see engines/ffmpeg.ts).
// Level 6, not 9: 9 costs ten seconds of build time to save half a megabyte.
const wasm = await readFile(join(nm, "@ffmpeg/core/dist/esm/ffmpeg-core.wasm"));
await writeFile(join(process.cwd(), "public/ffmpeg/ffmpeg-core.wasm.gz"), gzipSync(wasm));
console.log("gzipped public/ffmpeg/ffmpeg-core.wasm.gz");

// Patch the worker's stubbed core loader back into a real dynamic import.
const STUB = `function t(e){return Promise.resolve().then((()=>{var t=new Error("Cannot find module '"+e+"'");throw t.code="MODULE_NOT_FOUND",t}))}`;
const workerSrc = await readFile(join(nm, "@ffmpeg/ffmpeg/dist/umd/814.ffmpeg.js"), "utf8");
if (!workerSrc.includes(STUB)) {
  throw new Error(
    "ffmpeg worker stub not found — @ffmpeg/ffmpeg changed shape, re-check the patch",
  );
}
const workerOut = join(process.cwd(), "public/ffmpeg/worker.js");
await writeFile(workerOut, workerSrc.replace(STUB, "function t(e){return import(e)}"));
console.log("patched public/ffmpeg/worker.js");
