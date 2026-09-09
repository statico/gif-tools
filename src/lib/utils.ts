import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// smui registers custom text sizes; tailwind-merge needs to know they're sizes.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": ["text-label", "text-ui", "text-heading", "text-stat", "text-hero"],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Slack emoji/upload friendly filename: lowercase, dashes, no surprises. */
export function slugify(s: string, fallback = "output"): string {
  const out = s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return out || fallback;
}

/**
 * Math.min/max propagate NaN, and a number field the user has cleared reads as
 * NaN, so an empty box would otherwise reach ffmpeg as `scale=NaN:270` or the
 * GIF encoder as a zero delay. Anything non-finite falls back to the low bound.
 */
export function clamp(v: number, lo: number, hi: number): number {
  return Number.isFinite(v) ? Math.min(Math.max(v, lo), hi) : lo;
}

export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

/**
 * Ink extents of text drawn with `textAlign: "center"`. `measureText().width`
 * is the advance box, which italic glyphs lean out of on both sides, so both
 * fitting and centring on it clipped the last letter. `dx` is how far the ink's
 * centre sits from the drawing origin: draw at `-dx` to centre the ink itself.
 */
export function inkMetrics(m: TextMetrics): { w: number; dx: number } {
  const l = m.actualBoundingBoxLeft;
  const r = m.actualBoundingBoxRight;
  const w = l + r;
  // Fall back to the advance width if a browser leaves the ink box empty.
  return w > 0 ? { w, dx: (r - l) / 2 } : { w: Math.max(1, m.width), dx: 0 };
}

export interface GifInfo {
  frames: number;
  /** Total of the per-frame delays, in milliseconds. */
  duration: number;
}

/** Walks a GIF's blocks to count frames and sum delays. Null if it isn't a GIF. */
export function gifInfo(b: Uint8Array): GifInfo | null {
  if (b.length < 13 || b[0] !== 0x47 || b[1] !== 0x49 || b[2] !== 0x46) return null;
  let pos = 13;
  if (b[10] & 0x80) pos += 3 << ((b[10] & 7) + 1);
  const skipSubBlocks = () => {
    let n: number;
    while (pos < b.length && (n = b[pos++]) !== 0) pos += n;
  };
  let frames = 0;
  let duration = 0;
  let delay = 0;
  while (pos < b.length) {
    const id = b[pos++];
    if (id === 0x2c) {
      pos += 8;
      const f = b[pos++];
      if (f & 0x80) pos += 3 << ((f & 7) + 1);
      pos++;
      skipSubBlocks();
      frames++;
      duration += delay;
      delay = 0;
    } else if (id === 0x21) {
      const label = b[pos++];
      if (label === 0xf9) delay = (b[pos + 2] | (b[pos + 3] << 8) || 10) * 10;
      skipSubBlocks();
    } else break;
  }
  return { frames, duration };
}
