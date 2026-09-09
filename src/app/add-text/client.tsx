"use client";
import * as React from "react";
import { ColorField, Input, Label, Range, Select } from "@/components/ui/field";
import { ToolShell, useAutoRun, useRun, type ToolBodyProps } from "@/components/tool-shell";
import { encodeGif } from "@/lib/engines/gif-encode";
import { MAX_FRAMES, useFrames } from "@/lib/preview";
import { getTool } from "@/lib/tools";

const tool = getTool("add-text");

type Mode = "overlay" | "bar";

interface Style {
  top: string;
  bottom: string;
  fontSize: number;
  color: string;
  outline: string;
  outlineWidth: number;
  mode: Mode;
  barColor: string;
}

const font = (size: number) => `bold ${size}px Impact, "Arial Black", sans-serif`;

/** Greedy word wrap; a single over-long word is left on its own line. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(next).width > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

/** Draw one frame plus its captions. Returns the canvas it drew into. */
function compose(canvas: HTMLCanvasElement, img: HTMLImageElement, s: Style) {
  const w = img.naturalWidth || 1;
  const h = img.naturalHeight || 1;
  const measure = canvas.getContext("2d", { willReadFrequently: true });
  if (!measure) throw new Error("Your browser would not give us a 2D canvas context.");
  measure.font = font(s.fontSize);

  const pad = Math.round(s.fontSize * 0.35);
  const lineHeight = s.fontSize * 1.15;
  const topLines = wrap(measure, s.top, w - pad * 2);
  const bottomLines = wrap(measure, s.bottom, w - pad * 2);
  const barHeight = (n: number) =>
    s.mode === "bar" && n ? Math.round(n * lineHeight + pad * 2) : 0;
  const topBar = barHeight(topLines.length);
  const bottomBar = barHeight(bottomLines.length);

  canvas.width = w;
  canvas.height = h + topBar + bottomBar;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Your browser would not give us a 2D canvas context.");

  if (s.mode === "bar") {
    ctx.fillStyle = s.barColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(img, 0, topBar, w, h);

  ctx.font = font(s.fontSize);
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.lineJoin = "round";
  ctx.lineWidth = s.outlineWidth * 2;
  ctx.strokeStyle = s.outline;
  ctx.fillStyle = s.color;

  const paint = (lines: string[], startY: number) =>
    lines.forEach((line, i) => {
      const y = startY + i * lineHeight;
      if (s.outlineWidth > 0) ctx.strokeText(line, w / 2, y);
      ctx.fillText(line, w / 2, y);
    });

  paint(topLines, s.mode === "bar" ? pad : topBar + pad);
  paint(
    bottomLines,
    s.mode === "bar"
      ? canvas.height - bottomBar + pad
      : canvas.height - pad - bottomLines.length * lineHeight,
  );

  return ctx;
}

function Body({ file, setBusy, setProgress, setError, publish }: ToolBodyProps) {
  const run = useRun({ setBusy, setError, setProgress });
  const { frames, delay, reading, truncated } = useFrames(file, setError, setProgress);
  const [frameDelay, setFrameDelay] = React.useState(100);
  React.useEffect(() => setFrameDelay(delay), [delay]);
  const [style, setStyle] = React.useState<Style>({
    top: "one does not simply",
    bottom: "make a meme",
    fontSize: 36,
    color: "#ffffff",
    outline: "#000000",
    outlineWidth: 3,
    mode: "overlay",
    barColor: "#ffffff",
  });
  const set = <K extends keyof Style>(k: K, v: Style[K]) =>
    setStyle((prev) => ({ ...prev, [k]: v }));

  const go = () =>
    run("Adding text", async () => {
      if (!frames.length) throw new Error("Choose a GIF or image first.");
      const canvas = document.createElement("canvas");
      const images: ImageData[] = [];
      frames.forEach((img, i) => {
        const ctx = compose(canvas, img, style);
        images.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
        setProgress(((i + 1) / frames.length) * 0.8);
      });
      const data = encodeGif(images, { delayMs: frameDelay, loop: 0, transparent: false });
      setProgress(1);
      publish({
        data,
        ext: "gif",
        note: `${style.mode} · ${style.fontSize}px · ${frames.length} frames`,
      });
    });

  useAutoRun(go, [frames, frameDelay, style], frames.length > 0 && !reading);
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="at-top">top text</Label>
          <Input id="at-top" value={style.top} onChange={(e) => set("top", e.target.value)} />
        </div>
        <div>
          <Label htmlFor="at-bottom">bottom text</Label>
          <Input
            id="at-bottom"
            value={style.bottom}
            onChange={(e) => set("bottom", e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="at-mode">placement</Label>
          <Select
            id="at-mode"
            value={style.mode}
            onChange={(e) => set("mode", e.target.value as Mode)}
          >
            <option value="overlay">overlay — text sits on the image</option>
            <option value="bar">caption bar — solid bar above/below</option>
          </Select>
        </div>
        <Range
          label="font size"
          suffix="px"
          min={8}
          max={160}
          step={1}
          value={style.fontSize}
          onChange={(e) => set("fontSize", Number(e.target.value))}
        />
        <ColorField
          id="at-color"
          label="text colour"
          value={style.color}
          onChange={(v) => set("color", v)}
        />
        <ColorField
          id="at-outline"
          label="outline colour"
          value={style.outline}
          onChange={(v) => set("outline", v)}
        />
        <Range
          label="outline width"
          suffix="px"
          min={0}
          max={12}
          step={1}
          value={style.outlineWidth}
          onChange={(e) => set("outlineWidth", Number(e.target.value))}
        />
        {style.mode === "bar" ? (
          <ColorField
            id="at-bar"
            label="caption bar colour"
            value={style.barColor}
            onChange={(v) => set("barColor", v)}
          />
        ) : null}
      </div>

      {truncated ? (
        <p role="status" className="text-ui text-[hsl(var(--smui-yellow))]">
          That file has more than {MAX_FRAMES} frames; only the first {MAX_FRAMES} are captioned.
        </p>
      ) : null}
    </>
  );
}

export default function AddTextTool() {
  return (
    <ToolShell
      tool={tool}
      accept="image/gif,image/png,image/jpeg,image/webp"
      defaultName="captioned"
      hint="Frames are decoded with ffmpeg, captioned on a canvas and re-encoded as a GIF. The preview updates as you type."
    >
      {(props) => <Body {...props} />}
    </ToolShell>
  );
}
