"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Range, Select } from "@/components/ui/field";
import { ToolShell, useRun, type ToolBodyProps } from "@/components/tool-shell";
import { encodeGif, loadImage, renderFrames } from "@/lib/engines/gif-encode";
import { getTool } from "@/lib/tools";

const tool = getTool("emojify");

const CHECKER: React.CSSProperties = {
  backgroundImage:
    "repeating-conic-gradient(hsl(var(--muted)) 0% 25%, hsl(var(--smui-surface-1)) 0% 50%)",
  backgroundSize: "16px 16px",
};

type EffectId =
  | "spin"
  | "bounce"
  | "zoom"
  | "wiggle"
  | "vibrate"
  | "rainbow"
  | "roll"
  | "shake"
  | "slide";

interface EffectDef {
  id: EffectId;
  name: string;
  /** Label, range and default for the effect's own amount control. */
  amount: { label: string; min: number; max: number; step: number; def: number; suffix: string };
  /** Fraction of the frame the artwork fills, so the motion has room. */
  fit: number;
  frames: number;
  delay: number;
  /** Which extra direction control, if any, this effect uses. */
  dir?: "rotation" | "edge";
}

const EFFECTS: EffectDef[] = [
  {
    id: "spin",
    name: "Spin",
    amount: { label: "turns per loop", min: 1, max: 4, step: 1, def: 1, suffix: "×" },
    fit: 0.72,
    frames: 12,
    delay: 60,
    dir: "rotation",
  },
  {
    id: "bounce",
    name: "Bounce",
    amount: { label: "bounce height", min: 5, max: 60, step: 1, def: 25, suffix: "%" },
    fit: 0.78,
    frames: 12,
    delay: 60,
  },
  {
    id: "zoom",
    name: "Zoom / pulse",
    amount: { label: "zoom amount", min: 5, max: 60, step: 1, def: 25, suffix: "%" },
    fit: 0.78,
    frames: 12,
    delay: 60,
  },
  {
    id: "wiggle",
    name: "Wiggle",
    amount: { label: "wiggle angle", min: 5, max: 90, step: 1, def: 20, suffix: "°" },
    fit: 0.82,
    frames: 10,
    delay: 55,
  },
  {
    id: "vibrate",
    name: "Vibrate",
    amount: { label: "vibration", min: 1, max: 12, step: 1, def: 3, suffix: "%" },
    fit: 1,
    frames: 6,
    delay: 30,
  },
  {
    id: "rainbow",
    name: "Rainbow",
    amount: { label: "hue sweep", min: 10, max: 100, step: 5, def: 100, suffix: "%" },
    fit: 1,
    frames: 12,
    delay: 70,
  },
  {
    id: "roll",
    name: "Roll",
    amount: { label: "travel", min: 20, max: 150, step: 5, def: 100, suffix: "%" },
    fit: 0.7,
    frames: 16,
    delay: 55,
    dir: "rotation",
  },
  {
    id: "shake",
    name: "Shake",
    amount: { label: "shake amount", min: 2, max: 25, step: 1, def: 9, suffix: "%" },
    fit: 1,
    frames: 8,
    delay: 45,
  },
  {
    id: "slide",
    name: "Slide in",
    amount: { label: "hold at the end", min: 0, max: 70, step: 5, def: 35, suffix: "%" },
    fit: 0.9,
    frames: 14,
    delay: 55,
    dir: "edge",
  },
];

const BY_ID: Record<EffectId, EffectDef> = Object.fromEntries(
  EFFECTS.map((e) => [e.id, e]),
) as Record<EffectId, EffectDef>;

function jitter(i: number, k: number) {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (!d) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (!s) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const chan = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [
    Math.round(chan(h + 1 / 3) * 255),
    Math.round(chan(h) * 255),
    Math.round(chan(h - 1 / 3) * 255),
  ];
}

interface Settings {
  effect: EffectId;
  size: number;
  frames: number;
  delay: number;
  amount: number;
  cw: boolean;
  edge: "left" | "right" | "top" | "bottom";
  bg: string | null;
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  i: number,
  s: Settings,
) {
  const { size } = s;
  const def = BY_ID[s.effect];
  const t = (i % s.frames) / s.frames;
  const a = s.amount;
  const spin = s.cw ? 1 : -1;

  ctx.globalCompositeOperation = "source-over";
  ctx.clearRect(0, 0, size, size);

  let fit = def.fit;
  let dx = 0;
  let dy = 0;
  let rot = 0;
  let scale = 1;

  switch (s.effect) {
    case "spin":
      rot = spin * a * 2 * Math.PI * t;
      break;
    case "bounce":
      dy = -(size * a) / 100 * Math.abs(Math.sin(Math.PI * t));
      break;
    case "zoom":
      scale = 1 + (a / 100) * Math.sin(2 * Math.PI * t);
      break;
    case "wiggle":
      rot = ((a * Math.PI) / 180) * Math.sin(2 * Math.PI * t);
      break;
    case "vibrate":
    case "shake": {
      const amt = (size * a) / 100;
      dx = jitter(i, 1) * amt;
      dy = jitter(i, 2) * amt;
      // Overscale so the jitter never drags an empty edge into frame.
      fit *= (size + 2 * amt) / size;
      break;
    }
    case "roll": {
      rot = spin * 2 * Math.PI * t;
      dx = spin * (t * 2 - 1) * ((size * a) / 100);
      break;
    }
    case "slide": {
      const move = Math.min(1, t / Math.max(0.05, 1 - a / 100));
      const eased = 1 - Math.pow(1 - move, 3);
      const off = (1 - eased) * size * 1.25;
      if (s.edge === "left") dx = -off;
      if (s.edge === "right") dx = off;
      if (s.edge === "top") dy = -off;
      if (s.edge === "bottom") dy = off;
      break;
    }
    case "rainbow":
      break;
  }

  const base = Math.min(size / img.width, size / img.height) * fit * scale;
  const w = img.width * base;
  const h = img.height * base;
  ctx.save();
  ctx.imageSmoothingQuality = "high";
  ctx.translate(size / 2 + dx, size / 2 + dy);
  if (rot) ctx.rotate(rot);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();

  if (s.effect === "rainbow") {
    const frame = ctx.getImageData(0, 0, size, size);
    const px = frame.data;
    const shift = t * (a / 100);
    for (let k = 0; k < px.length; k += 4) {
      if (px[k + 3] === 0) continue; // preserve transparency
      const [h0, s0, l0] = rgbToHsl(px[k], px[k + 1], px[k + 2]);
      const out = hslToRgb((h0 + shift) % 1, Math.max(s0, 0.7), l0);
      px[k] = out[0];
      px[k + 1] = out[1];
      px[k + 2] = out[2];
    }
    ctx.putImageData(frame, 0, 0);
  }

  if (s.bg) {
    ctx.globalCompositeOperation = "destination-over";
    ctx.fillStyle = s.bg;
    ctx.fillRect(0, 0, size, size);
    ctx.globalCompositeOperation = "source-over";
  }
}

function Body({ file, setBusy, setProgress, setError, publish }: ToolBodyProps) {
  const run = useRun({ setBusy, setError, setProgress });
  const [effect, setEffect] = React.useState<EffectId>("spin");
  const [size, setSize] = React.useState(128);
  const [frames, setFrames] = React.useState(BY_ID.spin.frames);
  const [delay, setDelay] = React.useState(BY_ID.spin.delay);
  const [amount, setAmount] = React.useState(BY_ID.spin.amount.def);
  const [cw, setCw] = React.useState(true);
  const [edge, setEdge] = React.useState<Settings["edge"]>("left");
  const [bgMode, setBgMode] = React.useState<"transparent" | "color">("transparent");
  const [bg, setBg] = React.useState("#ffffff");
  const [img, setImg] = React.useState<HTMLImageElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  const def = BY_ID[effect];
  const safeBg = /^#[0-9a-fA-F]{6}$/.test(bg) ? bg : "#ffffff";
  const settings: Settings = {
    effect,
    size,
    frames,
    delay,
    amount,
    cw,
    edge,
    bg: bgMode === "color" ? safeBg : null,
  };

  // Each effect has a look that only works at its own tempo, so switching
  // effect reloads that effect's defaults.
  const pick = (id: EffectId) => {
    const d = BY_ID[id];
    setEffect(id);
    setFrames(d.frames);
    setDelay(d.delay);
    setAmount(d.amount.def);
  };

  React.useEffect(() => {
    if (!file) {
      setImg(null);
      return;
    }
    let live = true;
    loadImage(file)
      .then((i) => live && setImg(i))
      .catch(() => setError("That file could not be decoded. Try a PNG, JPEG, GIF or WebP."));
    return () => {
      live = false;
    };
  }, [file, setError]);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      drawFrame(ctx, img, 0, settings);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      drawFrame(ctx, img, Math.floor(((now - start) / delay) % frames), settings);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [img, effect, size, frames, delay, amount, cw, edge, bgMode, safeBg]);

  const go = () =>
    run("Animating", async () => {
      if (!file) throw new Error("Choose an image first.");
      const source = img ?? (await loadImage(file));
      setProgress(0.4);
      const data = renderFrames({ width: size, height: size }, frames, (ctx, _t, i) =>
        drawFrame(ctx, source, i, settings),
      );
      setProgress(0.8);
      publish({
        data: encodeGif(data, { delayMs: delay, transparent: bgMode === "transparent" }),
        ext: "gif",
        note: `${def.name} · ${size}px · ${frames}f · ${delay}ms`,
      });
      setProgress(1);
    });

  return (
    <>
      <div role="group" aria-labelledby="emo-effect-label">
        <span
          id="emo-effect-label"
          className="text-label text-muted-foreground tracking-[1.5px] uppercase block mb-1"
        >
          effect
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {EFFECTS.map((e) => (
            <Button
              key={e.id}
              type="button"
              variant={e.id === effect ? "default" : "outline"}
              size="sm"
              aria-pressed={e.id === effect}
              onClick={() => pick(e.id)}
            >
              {e.name}
            </Button>
          ))}
        </div>
      </div>

      <div>
        <Label>preview</Label>
        <div
          className="flex items-center justify-center border border-border p-4"
          style={bgMode === "transparent" ? CHECKER : undefined}
        >
          {img ? (
            <canvas
              ref={canvasRef}
              width={size}
              height={size}
              role="img"
              aria-label={`Live preview of the ${def.name} effect`}
              style={{ width: 128, height: 128, imageRendering: size < 128 ? "pixelated" : "auto" }}
            />
          ) : (
            <p className="text-ui text-muted-foreground py-8">Choose an image to preview.</p>
          )}
        </div>
        <p className="text-label text-muted-foreground mt-1" role="status" aria-live="polite">
          {def.name} — {frames} frames at {delay}ms
        </p>
      </div>

      <Range
        label={def.amount.label}
        suffix={def.amount.suffix}
        min={def.amount.min}
        max={def.amount.max}
        step={def.amount.step}
        value={amount}
        onChange={(e) => setAmount(Number(e.target.value))}
      />

      {def.dir === "rotation" ? (
        <div>
          <Label htmlFor="emo-dir">rotation direction</Label>
          <Select id="emo-dir" value={cw ? "cw" : "ccw"} onChange={(e) => setCw(e.target.value === "cw")}>
            <option value="cw">Clockwise</option>
            <option value="ccw">Anticlockwise</option>
          </Select>
        </div>
      ) : null}

      {def.dir === "edge" ? (
        <div>
          <Label htmlFor="emo-edge">slide in from</Label>
          <Select
            id="emo-edge"
            value={edge}
            onChange={(e) => setEdge(e.target.value as Settings["edge"])}
          >
            <option value="left">Left</option>
            <option value="right">Right</option>
            <option value="top">Top</option>
            <option value="bottom">Bottom</option>
          </Select>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Range
          label="frames"
          min={2}
          max={32}
          step={1}
          value={frames}
          onChange={(e) => setFrames(Number(e.target.value))}
        />
        <Range
          label="frame delay"
          suffix="ms"
          min={20}
          max={200}
          step={5}
          value={delay}
          onChange={(e) => setDelay(Number(e.target.value))}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="emo-size">output size</Label>
          <Select id="emo-size" value={size} onChange={(e) => setSize(Number(e.target.value))}>
            <option value={32}>32 × 32</option>
            <option value={64}>64 × 64</option>
            <option value={128}>128 × 128 — Slack emoji</option>
            <option value={256}>256 × 256</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="emo-bg">background</Label>
          <Select
            id="emo-bg"
            value={bgMode}
            onChange={(e) => setBgMode(e.target.value as "transparent" | "color")}
          >
            <option value="transparent">Transparent</option>
            <option value="color">Solid colour</option>
          </Select>
        </div>
      </div>

      {bgMode === "color" ? (
        <div className="flex items-end gap-2">
          <div className="w-24">
            <Label htmlFor="emo-bg-color">colour</Label>
            <Input
              id="emo-bg-color"
              type="color"
              value={safeBg}
              onChange={(e) => setBg(e.target.value)}
              className="p-1"
            />
          </div>
          <div className="flex-1 min-w-0">
            <Label htmlFor="emo-bg-hex">hex value</Label>
            <Input
              id="emo-bg-hex"
              value={bg}
              spellCheck={false}
              pattern="#[0-9a-fA-F]{6}"
              aria-invalid={bg !== safeBg}
              onChange={(e) => setBg(e.target.value.trim())}
            />
          </div>
        </div>
      ) : null}

      <Button onClick={go} disabled={!file}>
        Make the emoji
      </Button>
    </>
  );
}

export default function EmojifyTool() {
  return (
    <ToolShell
      tool={tool}
      accept="image/png,image/jpeg,image/webp,image/gif"
      defaultName="emoji"
      hint="Pick an effect and watch the live preview before you encode. Each effect loads its own tempo, which you can then override."
    >
      {(props) => <Body {...props} />}
    </ToolShell>
  );
}
