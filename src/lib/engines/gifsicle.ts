"use client";

/**
 * gifsicle compiled to wasm. The package ships a single bundle that takes a
 * shell-style command plus in-memory files, so this wrapper stays thin.
 */
type GifsicleRun = (opts: {
  input: { file: Blob | File | string; name: string }[];
  command: string[];
}) => Promise<File[]>;

let mod: { run: GifsicleRun } | null = null;

async function load() {
  if (!mod) {
    // Dynamic import: gifsicle's bundle touches `window` at module scope.
    mod = (await import("gifsicle-wasm-browser")).default as unknown as { run: GifsicleRun };
  }
  return mod;
}

/**
 * Run one gifsicle command.
 * `command` uses `input.gif` / `output.gif` as the file names, e.g.
 *   ["-O3 --lossy=80 input.gif -o /out/output.gif"]
 */
export async function runGifsicle(
  file: Blob | File,
  command: string[],
  inputName = "input.gif",
): Promise<Uint8Array> {
  const g = await load();
  const out = await g.run({
    input: [{ file, name: inputName }],
    command,
  });
  if (!out?.length) throw new Error("gifsicle produced no output");
  return new Uint8Array(await out[0].arrayBuffer());
}

export interface OptimizeOptions {
  /** 1-3; higher optimises harder and takes longer. */
  level?: 1 | 2 | 3;
  /** 1-200ish. Higher = smaller and uglier. 0/undefined disables lossy. */
  lossy?: number;
  /** Reduce the palette to at most this many colours (2-256). */
  colors?: number;
  /** Scale factor, e.g. 0.5 for half size. */
  scale?: number;
  /** Keep every Nth frame. 2 drops every other frame. */
  keepEveryNthFrame?: number;
}

export async function optimizeGif(
  file: Blob | File,
  { level = 3, lossy, colors, scale, keepEveryNthFrame }: OptimizeOptions = {},
): Promise<Uint8Array> {
  const parts = [`-O${level}`];
  if (lossy && lossy > 0) parts.push(`--lossy=${Math.round(lossy)}`);
  if (colors && colors < 256) parts.push(`--colors=${Math.round(colors)}`);
  if (scale && scale !== 1) parts.push(`--scale=${scale}`);
  parts.push("input.gif");
  if (keepEveryNthFrame && keepEveryNthFrame > 1) {
    // gifsicle has no "every Nth"; select the frames explicitly via #a-b syntax
    // is awkward, so leave frame dropping to the ffmpeg-based speed tool.
    throw new Error("frame dropping lives in the speed tool, not the optimizer");
  }
  parts.push("-o", "/out/output.gif");
  return runGifsicle(file, [parts.join(" ")]);
}
