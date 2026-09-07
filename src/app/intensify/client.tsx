"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Range, Select } from "@/components/ui/field";
import { ToolShell, useRun, type ToolBodyProps } from "@/components/tool-shell";
import { encodeGif, loadImage, renderFrames } from "@/lib/engines/gif-encode";
import { getTool } from "@/lib/tools";

const tool = getTool("intensify");

const CHECKER: React.CSSProperties = {
  backgroundImage:
    "repeating-conic-gradient(hsl(var(--muted)) 0% 25%, hsl(var(--smui-surface-1)) 0% 50%)",
  backgroundSize: "16px 16px",
};

/** Deterministic jitter so the preview and the encoded GIF match exactly. */
function jitter(i: number, k: number) {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

type Axes = "both" | "x" | "y";
type Edge = "crop" | "pad";

interface Settings {
  size: number;
  frames: number;
  delay: number;
  intensity: number;
  axes: Axes;
  edge: Edge;
  bg: string | null;
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  i: number,
  s: Settings,
) {
  const { size } = s;
  ctx.clearRect(0, 0, size, size);
  if (s.bg) {
    ctx.fillStyle = s.bg;
    ctx.fillRect(0, 0, size, size);
  }
  const amt = (size * s.intensity) / 100;
  const dx = s.axes === "y" ? 0 : jitter(i, 1) * amt;
  const dy = s.axes === "x" ? 0 : jitter(i, 2) * amt;
  // Crop mode overscales so the shake never drags an empty edge into view.
  const grow = s.edge === "crop" ? (size + 2 * amt) / size : 1;
  const scale = Math.min(size / img.width, size / img.height) * grow;
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, (size - w) / 2 + dx, (size - h) / 2 + dy, w, h);
}

function Body({ file, setBusy, setProgress, setError, publish }: ToolBodyProps) {
  const run = useRun({ setBusy, setError, setProgress });
  const [size, setSize] = React.useState(128);
  const [frames, setFrames] = React.useState(6);
  const [delay, setDelay] = React.useState(40);
  const [intensity, setIntensity] = React.useState(8);
  const [axes, setAxes] = React.useState<Axes>("both");
  const [edge, setEdge] = React.useState<Edge>("crop");
  const [bgMode, setBgMode] = React.useState<"transparent" | "color">("transparent");
  const [color, setColor] = React.useState("#ffffff");
  const [img, setImg] = React.useState<HTMLImageElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  const safeColor = /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#ffffff";
  const settings: Settings = {
    size,
    frames,
    delay,
    intensity,
    axes,
    edge,
    bg: bgMode === "color" ? safeColor : null,
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

  // Live preview. Static first frame when the user asked for less motion.
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
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
      const i = Math.floor(((now - start) / delay) % frames);
      drawFrame(ctx, img, i, settings);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [img, size, frames, delay, intensity, axes, edge, bgMode, color]);

  const go = () =>
    run("Shaking", async () => {
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
        note: `${size}px · ${frames}f · ${delay}ms · ${intensity}% shake`,
      });
      setProgress(1);
    });

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="int-size">output size</Label>
          <Select id="int-size" value={size} onChange={(e) => setSize(Number(e.target.value))}>
            <option value={32}>32 × 32</option>
            <option value={64}>64 × 64</option>
            <option value={128}>128 × 128 — Slack emoji</option>
            <option value={256}>256 × 256</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="int-axes">shake direction</Label>
          <Select id="int-axes" value={axes} onChange={(e) => setAxes(e.target.value as Axes)}>
            <option value="both">Both axes</option>
            <option value="x">Horizontal only</option>
            <option value="y">Vertical only</option>
          </Select>
        </div>
      </div>

      <Range
        label="shake intensity"
        suffix="% of size"
        min={1}
        max={25}
        step={1}
        value={intensity}
        onChange={(e) => setIntensity(Number(e.target.value))}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Range
          label="frames"
          min={2}
          max={16}
          step={1}
          value={frames}
          onChange={(e) => setFrames(Number(e.target.value))}
        />
        <Range
          label="frame delay"
          suffix="ms"
          min={20}
          max={120}
          step={5}
          value={delay}
          onChange={(e) => setDelay(Number(e.target.value))}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="int-edge">edge handling</Label>
          <Select id="int-edge" value={edge} onChange={(e) => setEdge(e.target.value as Edge)}>
            <option value="crop">Crop in — never show empty edges</option>
            <option value="pad">Pad — let the background show</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="int-bg">background</Label>
          <Select
            id="int-bg"
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
            <Label htmlFor="int-color">colour</Label>
            <Input
              id="int-color"
              type="color"
              value={safeColor}
              onChange={(e) => setColor(e.target.value)}
              className="p-1"
            />
          </div>
          <div className="flex-1 min-w-0">
            <Label htmlFor="int-hex">hex value</Label>
            <Input
              id="int-hex"
              value={color}
              spellCheck={false}
              pattern="#[0-9a-fA-F]{6}"
              aria-invalid={color !== safeColor}
              onChange={(e) => setColor(e.target.value.trim())}
            />
          </div>
        </div>
      ) : null}

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
              aria-label="Live preview of the intensified emoji"
              role="img"
              style={{ width: 128, height: 128, imageRendering: size < 128 ? "pixelated" : "auto" }}
            />
          ) : (
            <p className="text-ui text-muted-foreground py-8">Choose an image to preview.</p>
          )}
        </div>
      </div>

      <Button onClick={go} disabled={!file}>
        Make it intensify
      </Button>
    </>
  );
}

export default function IntensifyTool() {
  return (
    <ToolShell
      tool={tool}
      accept="image/png,image/jpeg,image/webp,image/gif"
      defaultName="intensifies"
      hint="A handful of frames at a short delay with random offsets — the classic [INTENSIFIES] look. Crop mode zooms in slightly so the shake never exposes an empty edge."
    >
      {(props) => <Body {...props} />}
    </ToolShell>
  );
}
