"use client";
import * as React from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label, Range, Select } from "@/components/ui/field";
import { ToolShell, useAutoRun, useRun, type ToolBodyProps } from "@/components/tool-shell";
import { ffmpegOnce, paletteGifArgs } from "@/lib/engines/ffmpeg";
import { useFirstFrame } from "@/lib/preview";
import { getTool } from "@/lib/tools";

const tool = getTool("effects");

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

type Effect = "none" | "grayscale" | "sepia" | "invert" | "blur" | "sharpen" | "posterize";

const DEFAULTS = {
  effect: "none" as Effect,
  amount: 3,
  levels: 4,
  brightness: 0,
  contrast: 1,
  saturation: 1,
  hue: 0,
};

type Settings = typeof DEFAULTS;

/** One operation, decided once and rendered two ways: as an ffmpeg filter for
 *  the real encode, and on a canvas for the live preview. */
type Op =
  | { kind: "matrix"; m: number[] }
  | { kind: "negate" }
  | { kind: "blur"; radius: number }
  | { kind: "sharpen"; amount: number }
  | { kind: "posterize"; step: number }
  | { kind: "eq"; brightness: number; contrast: number; saturation: number }
  | { kind: "hue"; degrees: number };

/**
 * THE effect maths. The only place settings turn into operations, so the
 * preview and the encode can never disagree about what is being applied.
 */
function effectOps(s: Settings): Op[] {
  const ops: Op[] = [];
  switch (s.effect) {
    case "grayscale":
      ops.push({ kind: "matrix", m: [0.3, 0.59, 0.11, 0.3, 0.59, 0.11, 0.3, 0.59, 0.11] });
      break;
    case "sepia":
      ops.push({
        kind: "matrix",
        m: [0.393, 0.769, 0.189, 0.349, 0.686, 0.168, 0.272, 0.534, 0.131],
      });
      break;
    case "invert":
      ops.push({ kind: "negate" });
      break;
    case "blur":
      ops.push({ kind: "blur", radius: s.amount });
      break;
    case "sharpen":
      ops.push({ kind: "sharpen", amount: s.amount });
      break;
    case "posterize":
      // Quantise each channel to `levels` steps.
      ops.push({ kind: "posterize", step: 255 / Math.max(s.levels - 1, 1) });
      break;
    default:
      break;
  }
  if (s.brightness !== 0 || s.contrast !== 1 || s.saturation !== 1) {
    ops.push({
      kind: "eq",
      brightness: s.brightness,
      contrast: s.contrast,
      saturation: s.saturation,
    });
  }
  if (s.hue !== 0) ops.push({ kind: "hue", degrees: s.hue });
  return ops;
}

function ffmpegFilters(ops: Op[]): string {
  return ops
    .map((op) => {
      switch (op.kind) {
        case "matrix": {
          const [a, b, c, d, e, f, g, h, i] = op.m;
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

function drawPreview(
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

function Body({ file, setBusy, setProgress, setError, publish }: ToolBodyProps) {
  const run = useRun({ setBusy, setError, setProgress });
  const [s, setS] = React.useState(DEFAULTS);
  const set = <K extends keyof typeof DEFAULTS>(k: K, v: (typeof DEFAULTS)[K]) =>
    setS((prev) => ({ ...prev, [k]: v }));

  const ops = effectOps(s);
  const { frame, size } = useFirstFrame(file);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  // Cap the preview so a 4K source still repaints instantly on every drag.
  const scale = size ? Math.min(280 / size.w, 280 / size.h, 1) : 1;
  const pw = size ? Math.max(1, Math.round(size.w * scale)) : 0;
  const ph = size ? Math.max(1, Math.round(size.h * scale)) : 0;

  React.useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d", { willReadFrequently: true });
    if (!ctx || !frame || !pw || !ph) return;
    drawPreview(ctx, frame, pw, ph, effectOps(s), scale);
  }, [frame, pw, ph, s, scale]);

  const go = () =>
    run("Applying effects", async () => {
      if (!file) throw new Error("Choose a GIF, image or video first.");

      if (ops.length === 0) {
        throw new Error("Pick an effect or move an adjustment slider — nothing to apply yet.");
      }

      const filters = ffmpegFilters(ops);
      const ext = outputExt(file);
      const srcExt = file.name.split(".").pop()?.toLowerCase() || "bin";

      const out = await ffmpegOnce(
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
        { onProgress: (r) => setProgress(r) },
      ).catch((err: unknown) => {
        throw new Error(
          `ffmpeg could not apply these filters (${err instanceof Error ? err.message : String(err)}). Try a milder setting or a different input format.`,
        );
      });

      publish({ data: out, ext, note: filters });
    });

  useAutoRun(go, [file, s], !!file);
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="fx-effect">effect</Label>
          <Select
            id="fx-effect"
            value={s.effect}
            onChange={(e) => set("effect", e.target.value as Effect)}
          >
            <option value="none">None</option>
            <option value="grayscale">Grayscale</option>
            <option value="sepia">Sepia</option>
            <option value="invert">Invert</option>
            <option value="blur">Blur</option>
            <option value="sharpen">Sharpen</option>
            <option value="posterize">Posterize</option>
          </Select>
        </div>

        {s.effect === "blur" || s.effect === "sharpen" ? (
          <Range
            id="fx-amount"
            aria-label={s.effect === "blur" ? "blur radius" : "sharpen amount"}
            label={s.effect === "blur" ? "blur radius" : "sharpen amount"}
            min={s.effect === "blur" ? 1 : 0.5}
            max={s.effect === "blur" ? 20 : 5}
            step={s.effect === "blur" ? 1 : 0.5}
            value={s.amount}
            onChange={(e) => set("amount", Number(e.target.value))}
          />
        ) : null}

        {s.effect === "posterize" ? (
          <Range
            id="fx-levels"
            aria-label="posterize levels"
            label="posterize levels"
            min={2}
            max={16}
            step={1}
            value={s.levels}
            onChange={(e) => set("levels", Number(e.target.value))}
          />
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Range
          id="fx-brightness"
          aria-label="brightness"
          label="brightness"
          min={-1}
          max={1}
          step={0.05}
          value={s.brightness}
          onChange={(e) => set("brightness", Number(e.target.value))}
        />
        <Range
          id="fx-contrast"
          aria-label="contrast"
          label="contrast"
          min={0}
          max={3}
          step={0.05}
          value={s.contrast}
          onChange={(e) => set("contrast", Number(e.target.value))}
        />
        <Range
          id="fx-saturation"
          aria-label="saturation"
          label="saturation"
          min={0}
          max={3}
          step={0.05}
          value={s.saturation}
          onChange={(e) => set("saturation", Number(e.target.value))}
        />
        <Range
          id="fx-hue"
          aria-label="hue shift in degrees"
          label="hue shift"
          min={-180}
          max={180}
          step={1}
          value={s.hue}
          suffix="°"
          onChange={(e) => set("hue", Number(e.target.value))}
        />
      </div>

      {frame ? (
        <div>
          <span className="text-label text-muted-foreground tracking-[1.5px] uppercase block mb-1">
            live preview
          </span>
          <div className="border-border flex justify-center border p-3">
            <canvas
              ref={canvasRef}
              width={pw}
              height={ph}
              className="checkerboard border-border block max-w-full border"
              role="img"
              aria-label={`First frame with the ${s.effect === "none" ? "current adjustments" : s.effect + " effect"} applied`}
            />
          </div>
          <p className="text-label text-muted-foreground mt-1">
            First frame only, updated as you drag. Apply effects to render the whole file.
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setS(DEFAULTS)}>
          <RotateCcw aria-hidden="true" />
          Reset to defaults
        </Button>
      </div>
    </>
  );
}

export default function EffectsTool() {
  return (
    <ToolShell
      tool={tool}
      accept="image/gif,image/png,image/jpeg,image/webp,video/*"
      defaultName="effects"
      hint="One effect at a time, stacked with the brightness, contrast, saturation and hue sliders. Animation is kept; still images come back as PNG."
    >
      {(props) => <Body {...props} />}
    </ToolShell>
  );
}
