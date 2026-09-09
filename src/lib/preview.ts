"use client";

import * as React from "react";
import { frameNames, probe, withFFmpeg } from "@/lib/engines/ffmpeg";
import { loadImage } from "@/lib/engines/gif-encode";

/** Shown when the browser cannot decode a file that the wasm engines still can. */
export const NO_PREVIEW = "This browser cannot decode that file, so there is no preview.";

/**
 * The first frame of a file, ready to draw on a canvas, so tools can show what
 * a setting does without paying for a full wasm encode.
 *
 * ponytail: first frame only. Animated previews would mean decoding every
 * frame in JS, which is the encode we are trying to avoid; the still is enough
 * to judge a crop, a rotation or a colour effect.
 */
export function useFirstFrame(file: File | null) {
  const [frame, setFrame] = React.useState<CanvasImageSource | null>(null);
  const [size, setSize] = React.useState<{ w: number; h: number } | null>(null);
  // The browser decodes fewer formats than ffmpeg does, so a file we cannot
  // preview is not a file the tool must refuse — callers show a note and let
  // the run go ahead rather than waiting on a frame that never arrives.
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    setFrame(null);
    setSize(null);
    setFailed(false);
    if (!file) return;

    let live = true;
    const url = URL.createObjectURL(file);
    const done = (src: CanvasImageSource, w: number, h: number) => {
      if (!live) return;
      setFrame(src);
      setSize({ w, h });
    };
    const fail = () => live && setFailed(true);

    if (file.type.startsWith("video/")) {
      const v = document.createElement("video");
      v.muted = true;
      v.preload = "auto";
      // Seek a hair past zero: frame 0 of an encoded video is often black.
      v.onloadeddata = () => {
        v.currentTime = Math.min(0.1, (v.duration || 1) / 10);
      };
      v.onseeked = () => done(v, v.videoWidth, v.videoHeight);
      v.onerror = fail;
      v.src = url;
    } else {
      const img = new Image();
      img.onload = () => done(img, img.naturalWidth, img.naturalHeight);
      img.onerror = fail;
      img.src = url;
    }

    return () => {
      live = false;
      URL.revokeObjectURL(url);
    };
  }, [file]);

  return { frame, size, failed };
}

export const MAX_FRAMES = 400;

/** Every frame of a source, plus the delay between them. Stills are one frame. */
export interface Anim {
  frames: HTMLImageElement[];
  delay: number;
}

/** The source frame showing at `ms` into its loop. */
export function frameAt(a: Anim, ms: number): HTMLImageElement {
  return a.frames[Math.floor(ms / a.delay) % a.frames.length];
}

/**
 * Output frame count at `delay` ms that covers both the effect's own cycle
 * and a full loop of an animated source, so neither cuts off mid-loop.
 */
export function outFrames(a: Anim, cycle: number, delay: number): number {
  if (a.frames.length < 2) return cycle;
  const loop = Math.ceil((a.frames.length * a.delay) / delay / cycle) * cycle;
  return Math.min(MAX_FRAMES, Math.max(cycle, loop));
}

const ANIMATED = /^(image\/(gif|webp|apng)|video\/)/;

/**
 * Decodes a file into frames once so tools can re-render without re-decoding.
 * Stills go straight through the browser; GIFs, WebPs and video are split by
 * ffmpeg (capped at MAX_FRAMES).
 */
export function useFrames(
  file: File | null,
  setError: (m: string | null) => void,
  setProgress?: (r: number) => void,
) {
  const [anim, setAnim] = React.useState<Anim>({ frames: [], delay: 100 });
  const [reading, setReading] = React.useState(false);
  const [truncated, setTruncated] = React.useState(false);

  React.useEffect(() => {
    // Clear first, always: a pick that fails to decode must not leave the old
    // file's frames in place for the next run to encode under the new name.
    setAnim({ frames: [], delay: 100 });
    setTruncated(false);
    if (!file) return;
    // Picking file B while A is still decoding must not let A's frames land.
    let stale = false;
    void (async () => {
      setError(null);
      setReading(true);
      try {
        if (!ANIMATED.test(file.type)) {
          const img = await loadImage(file);
          if (!stale) setAnim({ frames: [img], delay: 100 });
          return;
        }
        const input = `in-${Date.now()}`;
        // Probe first: it takes the same queue slot withFFmpeg holds, so calling
        // it from inside the closure would wait on a job that is waiting on it.
        const { durationSec } = await probe(file);
        await withFFmpeg(async (ff) => {
          try {
            await ff.writeFile(input, new Uint8Array(await file.arrayBuffer()));
            const code = await ff.exec(["-i", input, "-vsync", "0", "frame-%04d.png"]);
            if (code !== 0)
              throw new Error("ffmpeg could not read that file. Try a GIF, PNG or JPEG.");
            const names = await frameNames(ff);
            const out: HTMLImageElement[] = [];
            for (const name of names.slice(0, MAX_FRAMES)) {
              const read = await ff.readFile(name);
              if (typeof read === "string") break;
              const data = read as Uint8Array;
              out.push(
                await loadImage(
                  new Blob([data.slice().buffer as ArrayBuffer], { type: "image/png" }),
                ),
              );
              setProgress?.(Math.min(0.9, out.length / 60));
            }
            if (!out.length)
              throw new Error("No frames came out of that file. Try a GIF, PNG or JPEG.");
            if (stale) return;
            setAnim({
              frames: out,
              delay:
                durationSec && out.length > 1
                  ? Math.max(20, Math.round((durationSec * 1000) / out.length))
                  : 100,
            });
            setTruncated(names.length > MAX_FRAMES);
            setProgress?.(1);
          } finally {
            // Delete by pattern: a truncated source leaves frames this run never read.
            for (const name of [input, ...(await frameNames(ff))]) {
              try {
                await ff.deleteFile(name);
              } catch {
                /* already gone */
              }
            }
          }
        });
      } catch (err) {
        if (!stale)
          setError(
            err instanceof Error
              ? err.message
              : "That file could not be decoded. Try a PNG, JPEG, GIF or WebP.",
          );
      } finally {
        if (!stale) setReading(false);
      }
    })();
    return () => {
      stale = true;
    };
  }, [file, setError, setProgress]);

  return { ...anim, reading, truncated };
}
