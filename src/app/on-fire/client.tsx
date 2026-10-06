"use client";
import * as React from "react";
import { Checkbox, Label, Range, Select } from "@/components/ui/field";
import { ToolShell, useAutoRun, useRun, type ToolBodyProps } from "@/components/tool-shell";
import { encodeGif, loadImage, renderFrames } from "@/lib/engines/gif-encode";
import { frameAt, outFrames, useFrames } from "@/lib/preview";
import { getTool } from "@/lib/tools";

const tool = getTool("on-fire");

// The fire2 Slack emoji, split into a 16-frame horizontal sprite sheet.
const FIRE_SRC = "/fire.png";
const FRAMES = 16;
const DELAY = 50;

interface Settings {
  size: number;
  subject: number;
  front: boolean;
}

function draw(
  ctx: CanvasRenderingContext2D,
  fire: HTMLImageElement,
  subject: HTMLImageElement,
  i: number,
  s: Settings,
) {
  const { size } = s;
  const fw = fire.width / FRAMES;
  const flame = () => ctx.drawImage(fire, (i % FRAMES) * fw, 0, fw, fire.height, 0, 0, size, size);
  ctx.imageSmoothingQuality = "high";
  flame();

  const box = (size * s.subject) / 100;
  const scale = Math.min(box / subject.width, box / subject.height);
  const w = subject.width * scale;
  const h = subject.height * scale;
  ctx.drawImage(subject, (size - w) / 2, size * 0.94 - h, w, h);

  if (s.front) {
    // The base of the fire again, over the subject's feet.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, size * 0.78, size, size);
    ctx.clip();
    flame();
    ctx.restore();
  }
}

function Body({ file, setBusy, setProgress, setError, publish }: ToolBodyProps) {
  const run = useRun({ setBusy, setError, setProgress });
  const [size, setSize] = React.useState(128);
  const [subject, setSubject] = React.useState(70);
  const [front, setFront] = React.useState(true);
  const [animate, setAnimate] = React.useState(true);
  const anim = useFrames(file, setError, setProgress);
  const img = anim.frames[0] ?? null;
  const animated = animate || anim.frames.length > 1;
  const [fire, setFire] = React.useState<HTMLImageElement | null>(null);

  React.useEffect(() => {
    loadImage(FIRE_SRC).then(setFire, () => setError("Could not load the fire image."));
  }, [setError]);

  const settings: Settings = { size, subject, front };

  const go = () =>
    run("Igniting", async () => {
      if (!img || !fire) throw new Error("Choose an image first.");
      if (!animated) {
        const c = document.createElement("canvas");
        c.width = c.height = size;
        const ctx = c.getContext("2d");
        if (!ctx) throw new Error("Your browser blocked the 2D canvas this tool needs.");
        draw(ctx, fire, img, 0, settings);
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
        draw(ctx, fire, frameAt(anim, i * DELAY), animate ? i % FRAMES : 0, settings),
      );
      setProgress(0.8);
      publish({
        data: encodeGif(data, { delayMs: DELAY, transparent: true }),
        ext: "gif",
        note: `${size}px · ${count}f · ${DELAY}ms`,
      });
      setProgress(1);
    });

  useAutoRun(go, [file, size, subject, front, animate, img, fire], !!img && !!fire);
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
      hint="Drop in whatever is on fire. A transparent PNG looks best, so the flames show around it; the background stays transparent."
    >
      {(props) => <Body {...props} />}
    </ToolShell>
  );
}
