"use client";
import * as React from "react";
import { Checkbox, Label, Range, Select } from "@/components/ui/field";
import { ToolShell, useAutoRun, useRun, type ToolBodyProps } from "@/components/tool-shell";
import { encodeGif, loadImage, renderFrames } from "@/lib/engines/gif-encode";
import { frameAt, outFrames, useFrames } from "@/lib/preview";
import { getTool } from "@/lib/tools";

const tool = getTool("old-man-yells");

// Transparent Grandpa Simpson from github.com/oncilla/old-man-yells-at (Apache-2.0).
const ABE_SRC = "/old-man.png";
const FRAMES = 8;
const DELAY = 60;

interface Settings {
  size: number;
  logo: number;
  shake: boolean;
}

/** Abe fills the bottom of the square, the target sits top-left above his fist. */
function draw(
  ctx: CanvasRenderingContext2D,
  abe: HTMLImageElement,
  target: HTMLImageElement,
  i: number,
  s: Settings,
) {
  const { size } = s;
  ctx.imageSmoothingQuality = "high";
  const w = size;
  const h = (abe.height * w) / abe.width;
  ctx.save();
  if (s.shake) {
    // Rock him about his shoulder so the fist pumps up and down.
    const px = size * 0.75;
    ctx.translate(px, size);
    ctx.rotate(Math.sin((i / FRAMES) * 2 * Math.PI) * 0.07);
    ctx.translate(-px, -size);
  }
  ctx.drawImage(abe, 0, size - h, w, h);
  ctx.restore();

  const box = (size * s.logo) / 100;
  const scale = Math.min(box / target.width, box / target.height);
  const tw = target.width * scale;
  const th = target.height * scale;
  const pad = size * 0.02;
  ctx.drawImage(target, pad + (box - tw) / 2, pad + (box - th) / 2, tw, th);
}

function Body({ file, setBusy, setProgress, setError, publish }: ToolBodyProps) {
  const run = useRun({ setBusy, setError, setProgress });
  const [size, setSize] = React.useState(128);
  const [logo, setLogo] = React.useState(38);
  const [shake, setShake] = React.useState(false);
  const [abe, setAbe] = React.useState<HTMLImageElement | null>(null);
  const anim = useFrames(file, setError, setProgress);
  const img = anim.frames[0] ?? null;
  const animated = shake || anim.frames.length > 1;

  React.useEffect(() => {
    loadImage(ABE_SRC).then(setAbe, () => setError("Could not load the Grandpa Simpson image."));
  }, [setError]);

  const settings: Settings = { size, logo, shake };

  const go = () =>
    run("Yelling", async () => {
      if (!img || !abe) throw new Error("Choose an image first.");
      if (!animated) {
        const c = document.createElement("canvas");
        c.width = c.height = size;
        const ctx = c.getContext("2d");
        if (!ctx) throw new Error("Your browser blocked the 2D canvas this tool needs.");
        draw(ctx, abe, img, 0, settings);
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
        draw(ctx, abe, frameAt(anim, i * DELAY), i % FRAMES, settings),
      );
      setProgress(0.8);
      publish({
        data: encodeGif(data, { delayMs: DELAY, transparent: true }),
        ext: "gif",
        note: `${size}px · ${count}f · ${DELAY}ms`,
      });
      setProgress(1);
    });

  useAutoRun(go, [file, size, logo, shake, img, abe], !!img && !!abe);
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="omy-size">output size</Label>
          <Select id="omy-size" value={size} onChange={(e) => setSize(Number(e.target.value))}>
            <option value={64}>64 × 64</option>
            <option value={128}>128 × 128 — Slack emoji</option>
            <option value={256}>256 × 256</option>
          </Select>
        </div>
        <Range
          label="target size"
          suffix="% of width"
          min={20}
          max={60}
          step={1}
          value={logo}
          onChange={(e) => setLogo(Number(e.target.value))}
        />
      </div>
      <Checkbox
        label="Shake fist (animated GIF; off gives a static PNG)"
        checked={shake}
        onChange={(e) => setShake(e.target.checked)}
      />
    </>
  );
}

export default function OldManYellsTool() {
  return (
    <ToolShell
      tool={tool}
      accept="image/png,image/jpeg,image/webp,image/gif"
      defaultName="old-man-yells-at"
      hint="Drop in the logo of whatever deserves yelling at. A transparent PNG logo looks best; the background stays transparent either way."
    >
      {(props) => <Body {...props} />}
    </ToolShell>
  );
}
