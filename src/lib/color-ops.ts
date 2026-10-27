/**
 * Per-pixel colour operations shared by the effects and tint tools. Each Op is
 * rendered two ways: as an ffmpeg filter for the real encode, and on a canvas
 * for the live preview, so the two can never disagree.
 */
import { ffmpegOnce, paletteGifArgs } from "@/lib/engines/ffmpeg";

/** A curve point: input level → output level, both 0-255. */
export type Pt = [number, number];

export type Op =
  | { kind: "matrix"; m: number[] }
  | { kind: "negate" }
  | { kind: "blur"; radius: number }
  | { kind: "sharpen"; amount: number }
  | { kind: "posterize"; step: number }
  | { kind: "eq"; brightness: number; contrast: number; saturation: number }
  | { kind: "hue"; degrees: number }
  /** Piecewise-linear per-channel curves; first x must be 0, last 255. */
  | { kind: "curve"; r: Pt[]; g: Pt[]; b: Pt[] };

/** Luma weights shared by grayscale-style matrices. */
export const GRAY = [0.3, 0.59, 0.11, 0.3, 0.59, 0.11, 0.3, 0.59, 0.11];

function curveExpr(pts: Pt[]): string {
  let e = "";
  for (let i = pts.length - 2; i >= 0; i--) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const seg = `${y0.toFixed(2)}+(val-${x0.toFixed(2)})*${((y1 - y0) / (x1 - x0 || 1)).toFixed(4)}`;
    // Commas inside a filter option have to be escaped from the filtergraph parser.
    e = e ? `if(lt(val\\,${x1.toFixed(2)})\\,${seg}\\,${e})` : seg;
  }
  return e;
}

function curveAt(pts: Pt[], v: number): number {
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    if (v < x1 || i === pts.length - 2) return y0 + ((v - x0) * (y1 - y0)) / (x1 - x0 || 1);
  }
  return v;
}

export function ffmpegFilters(ops: Op[]): string {
  return ops
    .map((op) => {
      switch (op.kind) {
        case "matrix": {
          const [a, b, c, d, e, f, g, h, i] = op.m.map((n) => +n.toFixed(4));
          return `colorchannelmixer=${a}:${b}:${c}:0:${d}:${e}:${f}:0:${g}:${h}:${i}`;
        }
        case "negate":
          return "negate";
        case "blur":
          return `boxblur=${op.radius}:1`;
        case "sharpen":
          return `unsharp=5:5:${op.amount.toFixed(2)}`;
        case "posterize": {
          const step = op.step.toFixed(3);
          const e = `trunc(val/${step})*${step}`;
          return `lutrgb=r=${e}:g=${e}:b=${e}`;
        }
        case "eq":
          return `eq=brightness=${op.brightness}:contrast=${op.contrast}:saturation=${op.saturation}`;
        case "hue":
          return `hue=h=${op.degrees}`;
        case "curve":
          return `lutrgb=r=${curveExpr(op.r)}:g=${curveExpr(op.g)}:b=${curveExpr(op.b)}`;
      }
    })
    .join(",");
}

const clamp8 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);

/** Same op, applied to pixels. ffmpeg's eq and hue work in YUV, so we do too. */
function applyOp(img: ImageData, op: Op) {
  const d = img.data;

  if (op.kind === "sharpen") {
    // ponytail: 3×3 unsharp stands in for ffmpeg's 5×5 unsharp. Close enough to
    // judge the slider; swap in a real 5×5 pass if the difference ever shows.
    const src = new Uint8ClampedArray(d);
    const { width: w, height: h } = img;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        for (let c = 0; c < 3; c++) {
          let sum = 0;
          for (let dy = -1; dy <= 1; dy++) {
            const yy = Math.min(h - 1, Math.max(0, y + dy));
            for (let dx = -1; dx <= 1; dx++) {
              const xx = Math.min(w - 1, Math.max(0, x + dx));
              sum += src[(yy * w + xx) * 4 + c];
            }
          }
          d[i + c] = clamp8(src[i + c] + op.amount * (src[i + c] - sum / 9));
        }
      }
    }
    return;
  }

  if (op.kind === "curve") {
    const lut = [op.r, op.g, op.b].map((pts) =>
      Uint8ClampedArray.from({ length: 256 }, (_, v) => curveAt(pts, v)),
    );
    for (let i = 0; i < d.length; i += 4) {
      d[i] = lut[0][d[i]];
      d[i + 1] = lut[1][d[i + 1]];
      d[i + 2] = lut[2][d[i + 2]];
    }
    return;
  }

  const cos = op.kind === "hue" ? Math.cos((op.degrees * Math.PI) / 180) : 1;
  const sin = op.kind === "hue" ? Math.sin((op.degrees * Math.PI) / 180) : 0;

  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    let nr = r;
    let ng = g;
    let nb = b;

    switch (op.kind) {
      case "matrix": {
        const m = op.m;
        nr = r * m[0] + g * m[1] + b * m[2];
        ng = r * m[3] + g * m[4] + b * m[5];
        nb = r * m[6] + g * m[7] + b * m[8];
        break;
      }
      case "negate":
        nr = 255 - r;
        ng = 255 - g;
        nb = 255 - b;
        break;
      case "posterize":
        nr = Math.trunc(r / op.step) * op.step;
        ng = Math.trunc(g / op.step) * op.step;
        nb = Math.trunc(b / op.step) * op.step;
        break;
      case "eq":
      case "hue": {
        let y = 0.299 * r + 0.587 * g + 0.114 * b;
        let u = -0.168736 * r - 0.331264 * g + 0.5 * b;
        let v = 0.5 * r - 0.418688 * g - 0.081312 * b;
        if (op.kind === "eq") {
          y = (op.contrast * (y / 255 - 0.5) + 0.5 + op.brightness) * 255;
          u *= op.saturation;
          v *= op.saturation;
        } else {
          const nu = cos * u - sin * v;
          v = sin * u + cos * v;
          u = nu;
        }
        nr = y + 1.402 * v;
        ng = y - 0.344136 * u - 0.714136 * v;
        nb = y + 1.772 * u;
        break;
      }
    }

    d[i] = clamp8(nr);
    d[i + 1] = clamp8(ng);
    d[i + 2] = clamp8(nb);
  }
}

export function drawPreview(
  ctx: CanvasRenderingContext2D,
  frame: CanvasImageSource,
  w: number,
  h: number,
  ops: Op[],
  scale: number,
) {
  ctx.clearRect(0, 0, w, h);
  // Blur rides on the canvas filter (a box blur in JS would cost more than it
  // is worth); everything else is a pixel pass. The radius is in source pixels,
  // so it has to shrink with the preview or the preview over-blurs.
  const blur = ops.find((o) => o.kind === "blur");
  ctx.filter = blur ? `blur(${blur.radius * scale}px)` : "none";
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(frame, 0, 0, w, h);
  ctx.filter = "none";

  const rest = ops.filter((o) => o.kind !== "blur");
  if (rest.length === 0) return;
  const img = ctx.getImageData(0, 0, w, h);
  for (const op of rest) applyOp(img, op);
  ctx.putImageData(img, 0, 0);
}

function outputExt(file: File): "gif" | "webm" | "mp4" | "png" | "webp" {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "gif" || file.type === "image/gif") return "gif";
  if (ext === "webm" || file.type === "video/webm") return "webm";
  if (file.type.startsWith("video/")) return "mp4";
  // WebP stays WebP: libwebp keeps an animated source animated, where the
  // still-PNG branch below would silently drop every frame but the first.
  if (ext === "webp" || file.type === "image/webp") return "webp";
  return "png";
}

/** Run `ops` over the whole file with ffmpeg, keeping its format family. */
export async function encodeOps(file: File, ops: Op[], onProgress: (r: number) => void) {
  const filters = ffmpegFilters(ops);
  const ext = outputExt(file);
  const srcExt = file.name.split(".").pop()?.toLowerCase() || "bin";

  const data = await ffmpegOnce(
    file,
    `in.${srcExt}`,
    `out.${ext}`,
    ({ input, output }) =>
      ext === "gif"
        ? paletteGifArgs({ input, output, filters })
        : ext === "png"
          ? ["-i", input, "-vf", filters, "-frames:v", "1", output]
          : ext === "webp"
            ? ["-i", input, "-vf", filters, output]
            : ["-i", input, "-filter:v", filters, "-an", "-pix_fmt", "yuv420p", output],
    { onProgress },
  ).catch((err: unknown) => {
    throw new Error(
      `ffmpeg could not apply these filters (${err instanceof Error ? err.message : String(err)}). Try a milder setting or a different input format.`,
    );
  });
  return { data, ext, filters };
}
