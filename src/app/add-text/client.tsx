"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Range, Select } from "@/components/ui/field";
import { ToolShell, useRun, type ToolBodyProps } from "@/components/tool-shell";
import { getFFmpeg, probe } from "@/lib/engines/ffmpeg";
import { encodeGif, loadImage } from "@/lib/engines/gif-encode";
import { getTool } from "@/lib/tools";

const tool = getTool("add-text");

const MAX_FRAMES = 400;
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
  const barHeight = (n: number) => (s.mode === "bar" && n ? Math.round(n * lineHeight + pad * 2) : 0);
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
  const [frames, setFrames] = React.useState<HTMLImageElement[]>([]);
  const [frameDelay, setFrameDelay] = React.useState(100);
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
  const previewRef = React.useRef<HTMLCanvasElement>(null);

  // Decode every frame once per file so typing only re-composites.
  React.useEffect(() => {
    if (!file) {
      setFrames([]);
      return;
    }
    void run("Reading frames", async () => {
      const ff = await getFFmpeg();
      const input = `in-${Date.now()}`;
      const written: string[] = [input];
      try {
        await ff.writeFile(input, new Uint8Array(await file.arrayBuffer()));
        const code = await ff.exec(["-i", input, "-vsync", "0", "frame-%04d.png"]);
        if (code !== 0) throw new Error("ffmpeg could not read that file. Try a GIF, PNG or JPEG.");
        const out: HTMLImageElement[] = [];
        for (let i = 1; i <= MAX_FRAMES; i++) {
          const name = `frame-${String(i).padStart(4, "0")}.png`;
          let data: Uint8Array;
          try {
            const read = await ff.readFile(name);
            if (typeof read === "string") break;
            data = read as Uint8Array;
          } catch {
            break;
          }
          written.push(name);
          out.push(await loadImage(new Blob([data.slice().buffer as ArrayBuffer], { type: "image/png" })));
          setProgress(Math.min(0.9, i / 60));
        }
        if (!out.length) throw new Error("No frames came out of that file. Try a GIF, PNG or JPEG.");
        setFrames(out);
        const { durationSec } = await probe(file);
        setFrameDelay(
          durationSec && out.length > 1
            ? Math.max(20, Math.round((durationSec * 1000) / out.length))
            : 100,
        );
        setProgress(1);
      } finally {
        for (const name of written) {
          try {
            await ff.deleteFile(name);
          } catch {
            /* already gone */
          }
        }
      }
    });
  }, [file, run, setProgress]);

  // Live preview of the first frame.
  React.useEffect(() => {
    const canvas = previewRef.current;
    if (!canvas || !frames.length) return;
    try {
      compose(canvas, frames[0], style);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [frames, style, setError]);

  const go = () =>
    run("Adding text", async () => {
      if (!frames.length) throw new Error("Choose a GIF or image first.");
      const canvas = document.createElement("canvas");
      const images: ImageData[] = [];
      frames.forEach((img, i) => {
        const ctx = compose(canvas, img, style);
        images.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
        setProgress((i + 1) / frames.length * 0.8);
      });
      const data = encodeGif(images, { delayMs: frameDelay, loop: 0, transparent: false });
      setProgress(1);
      publish({
        data,
        ext: "gif",
        note: `${style.mode} · ${style.fontSize}px · ${frames.length} frames`,
      });
    });

  const colorField = (
    id: string,
    label: string,
    value: string,
    onChange: (v: string) => void,
  ) => (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <input
          id={id}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 border border-input bg-background p-1 shrink-0"
        />
        <Input
          aria-label={`${label} hex value`}
          value={value}
          spellCheck={false}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );

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
        {colorField("at-color", "text colour", style.color, (v) => set("color", v))}
        {colorField("at-outline", "outline colour", style.outline, (v) => set("outline", v))}
        <Range
          label="outline width"
          suffix="px"
          min={0}
          max={12}
          step={1}
          value={style.outlineWidth}
          onChange={(e) => set("outlineWidth", Number(e.target.value))}
        />
        {style.mode === "bar"
          ? colorField("at-bar", "caption bar colour", style.barColor, (v) => set("barColor", v))
          : null}
      </div>

      <div>
        <Label htmlFor="at-preview">preview — first frame</Label>
        <div className="border border-border bg-smui-surface-0 p-2 flex justify-center">
          {frames.length ? (
            <canvas
              id="at-preview"
              ref={previewRef}
              aria-label="Preview of the first frame with your caption"
              role="img"
              className="max-w-full max-h-72 object-contain"
            />
          ) : (
            <p className="text-ui text-muted-foreground" aria-live="polite">
              Choose a GIF or image to see the preview.
            </p>
          )}
        </div>
      </div>

      <Button onClick={go} disabled={!frames.length}>
        Add text
      </Button>
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
