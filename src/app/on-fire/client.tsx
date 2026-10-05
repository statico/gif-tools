"use client";
import * as React from "react";
import { Checkbox, Label, Range, Select } from "@/components/ui/field";
import { ToolShell, useAutoRun, useRun, type ToolBodyProps } from "@/components/tool-shell";
import { encodeGif, renderFrames } from "@/lib/engines/gif-encode";
import { frameAt, outFrames, useFrames } from "@/lib/preview";
import { getTool } from "@/lib/tools";

const tool = getTool("on-fire");

const FRAMES = 12;
const DELAY = 60;

/** Back to front: tongue count, height as a share of the flame height, gradient bottom → top. */
const LAYERS = [
  { tongues: 3, height: 1, seed: 0.3, colors: ["#ff5a1f", "#d4180c", "rgba(160,10,0,0.85)"] },
  { tongues: 4, height: 0.72, seed: 1.7, colors: ["#ffb020", "#ff6a10", "#f0380c"] },
  { tongues: 5, height: 0.45, seed: 2.9, colors: ["#fff6c0", "#ffe040", "#ffa010"] },
] as const;

interface Settings {
  size: number;
  subject: number;
  flames: number;
  front: boolean;
}

/**
 * One row of flame tongues. Each tongue is a cusp of 1 - |sin| so the tips come
 * to a point; its height flickers on whole cycles of t, so the GIF loops cleanly.
 */
function flameLayer(
  ctx: CanvasRenderingContext2D,
  size: number,
  top: number,
  t: number,
  layer: (typeof LAYERS)[number],
) {
  const h = size * top * layer.height;
  const tau = 2 * Math.PI;
  const sway = layer.seed + 0.25 * Math.sin(tau * t + layer.seed);
  ctx.beginPath();
  ctx.moveTo(0, size);
  for (let x = 0; x <= size; x++) {
    const u = (Math.PI * x * layer.tongues) / size + sway;
    const tip = (1 - Math.abs(Math.sin(u))) ** 2;
    const k = Math.floor(u / Math.PI + 0.5);
    const flicker = 0.75 + 0.25 * Math.sin(tau * 2 * t + k * 2.4 + layer.seed);
    ctx.lineTo(x, size - h * (0.3 + 0.7 * tip * flicker));
  }
  ctx.lineTo(size, size);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, size, 0, size - h);
  layer.colors.forEach((c, i) => g.addColorStop(i / (layer.colors.length - 1), c));
  ctx.fillStyle = g;
  ctx.fill();
}

function draw(ctx: CanvasRenderingContext2D, subject: HTMLImageElement, i: number, s: Settings) {
  const { size } = s;
  const t = i / FRAMES;
  const top = s.flames / 100;
  ctx.imageSmoothingQuality = "high";
  for (const layer of LAYERS) flameLayer(ctx, size, top, t, layer);

  const box = (size * s.subject) / 100;
  const scale = Math.min(box / subject.width, box / subject.height);
  const w = subject.width * scale;
  const h = subject.height * scale;
  ctx.drawImage(subject, (size - w) / 2, size * 0.94 - h, w, h);

  // A short row of yellow tongues licking up over the subject's base.
  if (s.front) flameLayer(ctx, size, top * 0.45, t + 0.5, LAYERS[2]);
}

function Body({ file, setBusy, setProgress, setError, publish }: ToolBodyProps) {
  const run = useRun({ setBusy, setError, setProgress });
  const [size, setSize] = React.useState(128);
  const [subject, setSubject] = React.useState(70);
  const [flames, setFlames] = React.useState(90);
  const [front, setFront] = React.useState(true);
  const [animate, setAnimate] = React.useState(true);
  const anim = useFrames(file, setError, setProgress);
  const img = anim.frames[0] ?? null;
  const animated = animate || anim.frames.length > 1;

  const settings: Settings = { size, subject, flames, front };

  const go = () =>
    run("Igniting", async () => {
      if (!img) throw new Error("Choose an image first.");
      if (!animated) {
        const c = document.createElement("canvas");
        c.width = c.height = size;
        const ctx = c.getContext("2d");
        if (!ctx) throw new Error("Your browser blocked the 2D canvas this tool needs.");
        draw(ctx, img, 0, settings);
        const blob = await new Promise<Blob | null>((res) => c.toBlob(res, "image/png"));
        if (!blob) throw new Error("The browser could not encode the PNG.");
        publish({
          data: new Uint8Array(await blob.arrayBuffer()),
          ext: "png",
          mime: "image/png",
          note: `${size}px static`,
        });
        return;
      }
      const count = outFrames(anim, FRAMES, DELAY);
      setProgress(0.4);
      const data = renderFrames({ width: size, height: size }, count, (ctx, _t, i) =>
        draw(ctx, frameAt(anim, i * DELAY), animate ? i % FRAMES : 0, settings),
      );
      setProgress(0.8);
      publish({
        data: encodeGif(data, { delayMs: DELAY, transparent: true }),
        ext: "gif",
        note: `${size}px · ${count}f · ${DELAY}ms`,
      });
      setProgress(1);
    });

  useAutoRun(go, [file, size, subject, flames, front, animate, img], !!img);
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="fire-size">output size</Label>
          <Select id="fire-size" value={size} onChange={(e) => setSize(Number(e.target.value))}>
            <option value={64}>64 × 64</option>
            <option value={128}>128 × 128 — Slack emoji</option>
            <option value={256}>256 × 256</option>
          </Select>
        </div>
        <Range
          label="image size"
          suffix="% of width"
          min={30}
          max={90}
          step={1}
          value={subject}
          onChange={(e) => setSubject(Number(e.target.value))}
        />
      </div>
      <Range
        label="flame height"
        suffix="% of height"
        min={40}
        max={100}
        step={1}
        value={flames}
        onChange={(e) => setFlames(Number(e.target.value))}
      />
      <Checkbox
        label="Flames in front of the image too"
        checked={front}
        onChange={(e) => setFront(e.target.checked)}
      />
      <Checkbox
        label="Animate flames (animated GIF; off gives a static PNG)"
        checked={animate}
        onChange={(e) => setAnimate(e.target.checked)}
      />
    </>
  );
}

export default function OnFireTool() {
  return (
    <ToolShell
      tool={tool}
      accept="image/png,image/jpeg,image/webp,image/gif"
      defaultName="on-fire"
      hint="Drop in whatever is on fire. A transparent PNG looks best, so the flames show around it; the background above the flames stays transparent."
    >
      {(props) => <Body {...props} />}
    </ToolShell>
  );
}
