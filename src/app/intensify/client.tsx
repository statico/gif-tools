"use client";
import * as React from "react";
import { ColorField, Input, Label, Range, Select } from "@/components/ui/field";
import { ToolShell, useAutoRun, useRun, type ToolBodyProps } from "@/components/tool-shell";
import { encodeGif, renderFrames } from "@/lib/engines/gif-encode";
import { frameAt, outFrames, useFrames } from "@/lib/preview";
import { getTool } from "@/lib/tools";

const tool = getTool("intensify");

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

function drawFrame(ctx: CanvasRenderingContext2D, img: HTMLImageElement, i: number, s: Settings) {
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
  const [bg, setBg] = React.useState(""); // "" = transparent
  const anim = useFrames(file, setError, setProgress);
  const img = anim.frames[0] ?? null;
  // Animated sources: enough output frames to play the whole source loop.
  const count = outFrames(anim, frames, delay);

  const settings: Settings = {
    size,
    frames,
    delay,
    intensity,
    axes,
    edge,
    bg: bg || null,
  };

  const go = () =>
    run("Shaking", async () => {
      if (!img) throw new Error("Choose an image first.");
      setProgress(0.4);
      const data = renderFrames({ width: size, height: size }, count, (ctx, _t, i) =>
        drawFrame(ctx, frameAt(anim, i * delay), i % frames, settings),
      );
      setProgress(0.8);
      publish({
        data: encodeGif(data, { delayMs: delay, transparent: !bg }),
        ext: "gif",
        note: `${size}px · ${count}f · ${delay}ms · ${intensity}% shake`,
      });
      setProgress(1);
    });

  useAutoRun(go, [file, size, frames, delay, intensity, axes, edge, img], !!img);
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
        <ColorField id="int-bg" label="background colour" value={bg} onChange={setBg} clearable />
      </div>
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
