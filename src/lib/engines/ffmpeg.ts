"use client";

import { FFmpeg } from "@ffmpeg/ffmpeg";

/**
 * Single-threaded ffmpeg core, loaded on demand from /ffmpeg/.
 *
 * ponytail: single-threaded core so the site needs no COOP/COEP headers and
 * no SharedArrayBuffer. Switch to @ffmpeg/core-mt (plus a `_headers` file
 * setting Cross-Origin-Opener-Policy/Embedder-Policy) if encode speed matters.
 */
let instance: FFmpeg | null = null;
let loading: Promise<FFmpeg> | null = null;

export type ProgressFn = (ratio: number, message?: string) => void;

/**
 * The 31MB core is served gzipped because Cloudflare Pages refuses to host a
 * file over 25MB, so it is inflated here and handed to ffmpeg as a blob URL.
 * The transfer is the same size either way — the browser would have negotiated
 * gzip anyway — this just moves the decompression from the edge into the page.
 */
async function inflateCore(): Promise<string> {
  const res = await fetch(new URL("/ffmpeg/ffmpeg-core.wasm.gz", location.href));
  if (!res.ok || !res.body) throw new Error(`could not fetch the ffmpeg core (HTTP ${res.status})`);
  const wasm = res.body.pipeThrough(new DecompressionStream("gzip"));
  const bytes = await new Response(wasm).arrayBuffer();
  return URL.createObjectURL(new Blob([bytes], { type: "application/wasm" }));
}

export async function getFFmpeg(onProgress?: ProgressFn): Promise<FFmpeg> {
  if (instance) return instance;
  if (!loading) {
    loading = (async () => {
      const ff = new FFmpeg();
      await ff.load({
        // classWorkerURL keeps ffmpeg's worker classic; the bundled one becomes
        // a module worker that can neither importScripts nor dynamic-import the core.
        // Absolute: ffmpeg.wasm resolves these against its own module URL, so a
        // root-relative path ends up as file:/// and the Worker refuses to load.
        classWorkerURL: new URL("/ffmpeg/worker.js", location.href).href,
        coreURL: new URL("/ffmpeg/ffmpeg-core.js", location.href).href,
        wasmURL: await inflateCore(),
      });
      instance = ff;
      return ff;
    })();
    loading.catch(() => {
      // let a later call retry instead of caching the rejection forever
      loading = null;
    });
  }
  onProgress?.(0, "loading ffmpeg");
  return loading;
}

/**
 * There is one ffmpeg instance and one virtual FS, so two concurrent runs
 * collide: fixed names like in.gif/out.gif get deleted out from under each
 * other, and probe()'s global log handler scrapes the other run's stderr.
 * Every exec goes through this chain, so they queue instead.
 */
let queue: Promise<unknown> = Promise.resolve();
function serialize<T>(job: () => Promise<T>): Promise<T> {
  const next = queue.then(job, job);
  queue = next.catch(() => {});
  return next;
}

/**
 * Borrow the shared instance for a multi-file job (split, add-text) that
 * runFFmpeg's one-in-one-out shape does not cover. Queued like every other run.
 */
export function withFFmpeg<T>(job: (ff: FFmpeg) => Promise<T>): Promise<T> {
  return getFFmpeg().then((ff) => serialize(() => job(ff)));
}

/** Every frame currently in the wasm FS, sorted. Never throws. */
export async function frameNames(ff: FFmpeg): Promise<string[]> {
  try {
    return (await ff.listDir("/"))
      .filter((n) => !n.isDir && /^frame-\d+\.png$/.test(n.name))
      .map((n) => n.name)
      .sort();
  } catch {
    return [];
  }
}

export interface RunOptions {
  /** Files to place in the virtual FS before running. */
  inputs: Record<string, Uint8Array | Blob | File>;
  /** ffmpeg argv, referencing the input names and output names directly. */
  args: string[];
  /** Names to read back out of the virtual FS when the run finishes. */
  outputs: string[];
  onProgress?: ProgressFn;
  /** Total duration in seconds, used to turn ffmpeg's progress into a ratio. */
  durationSec?: number;
}

async function toBytes(v: Uint8Array | Blob | File): Promise<Uint8Array> {
  if (v instanceof Uint8Array) return v;
  return new Uint8Array(await v.arrayBuffer());
}

/**
 * Run one ffmpeg invocation. Always cleans up the virtual FS so repeated runs
 * in a long-lived tab don't leak the whole file heap.
 */
export async function runFFmpeg({
  inputs,
  args,
  outputs,
  onProgress,
  durationSec,
}: RunOptions): Promise<Record<string, Uint8Array>> {
  const ff = await getFFmpeg(onProgress);
  return serialize(async () => {
    const written: string[] = [];

    const handler = ({ progress, time }: { progress: number; time: number }) => {
      // ffmpeg's own `progress` is unreliable for some filters; prefer time/duration.
      const ratio = durationSec && durationSec > 0 ? time / 1e6 / durationSec : progress;
      if (Number.isFinite(ratio)) onProgress?.(Math.min(Math.max(ratio, 0), 1));
    };
    ff.on("progress", handler);

    // Outputs are cleaned up whether or not the run succeeds: a non-zero exec
    // can still have created the file, and ffmpeg refuses to overwrite it on
    // the next run ("File 'out.mp4' already exists. Exiting."), which would
    // wedge the tool until reload.
    written.push(...outputs);

    try {
      for (const [name, data] of Object.entries(inputs)) {
        await ff.writeFile(name, await toBytes(data));
        written.push(name);
      }

      // -y: never stop to ask about an overwrite, there is no tty to answer.
      const code = await ff.exec(["-y", ...args]);
      if (code !== 0) throw new Error(`ffmpeg exited with code ${code}`);

      const result: Record<string, Uint8Array> = {};
      for (const name of outputs) {
        const data = await ff.readFile(name);
        if (typeof data === "string") throw new Error(`expected binary output for ${name}`);
        result[name] = data as Uint8Array;
      }
      onProgress?.(1);
      return result;
    } finally {
      ff.off("progress", handler);
      for (const name of written) {
        try {
          await ff.deleteFile(name);
        } catch {
          /* already gone */
        }
      }
    }
  });
}

/** Convenience: one input, one output. */
export async function ffmpegOnce(
  file: Blob | File | Uint8Array,
  inputName: string,
  outputName: string,
  args: (io: { input: string; output: string }) => string[],
  opts: { onProgress?: ProgressFn; durationSec?: number } = {},
): Promise<Uint8Array> {
  const out = await runFFmpeg({
    inputs: { [inputName]: file },
    args: args({ input: inputName, output: outputName }),
    outputs: [outputName],
    ...opts,
  });
  return out[outputName];
}

/**
 * Two-pass palette GIF encode — the reason ffmpeg GIFs look better than
 * naive ones. `filters` is inserted before the palette stage.
 */
export function paletteGifArgs({
  input,
  output,
  filters,
  colors = 256,
  dither = "bayer:bayer_scale=5",
  loop = 0,
}: {
  input: string;
  output: string;
  filters: string;
  colors?: number;
  dither?: string;
  loop?: number;
}): string[] {
  const chain =
    `${filters},split[a][b];[a]palettegen=max_colors=${colors}:stats_mode=diff[p];` +
    `[b][p]paletteuse=dither=${dither}:diff_mode=rectangle`;
  return ["-i", input, "-filter_complex", chain, "-loop", String(loop), "-f", "gif", output];
}

/** Probe a media file for duration/size by parsing ffmpeg's stderr log. */
export async function probe(file: Blob | File): Promise<{
  durationSec: number | null;
  width: number | null;
  height: number | null;
  fps: number | null;
}> {
  const ff = await getFFmpeg();
  const name = `probe-${Date.now()}`;
  const lines: string[] = [];
  const onLog = ({ message }: { message: string }) => lines.push(message);
  const text = await serialize(async () => {
    ff.on("log", onLog);
    try {
      await ff.writeFile(name, new Uint8Array(await file.arrayBuffer()));
      // No output file: ffmpeg errors out after printing the stream info we want.
      await ff.exec(["-i", name]).catch(() => {});
    } finally {
      ff.off("log", onLog);
      try {
        await ff.deleteFile(name);
      } catch {
        /* ignore */
      }
    }
    return lines.join("\n");
  });
  const dur = text.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
  const dim = text.match(/,\s*(\d{2,5})x(\d{2,5})[\s,]/);
  // ffmpeg prints both "25 fps" and "25 tbr"; the first is the container's own
  // rate, which is what a speed multiplier is applied to.
  const rate = text.match(/,\s*([\d.]+)\s*fps[\s,]/);
  return {
    durationSec: dur ? +dur[1] * 3600 + +dur[2] * 60 + +dur[3] : null,
    width: dim ? +dim[1] : null,
    height: dim ? +dim[2] : null,
    fps: rate && Number.isFinite(+rate[1]) && +rate[1] > 0 ? +rate[1] : null,
  };
}
