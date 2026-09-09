"use client";
import * as React from "react";
import { Pipette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ColorField, Range } from "@/components/ui/field";
import { ToolShell, useRun, type ToolBodyProps } from "@/components/tool-shell";
import { ffmpegOnce, paletteGifArgs } from "@/lib/engines/ffmpeg";
import { NO_PREVIEW, useFirstFrame } from "@/lib/preview";
import { getTool } from "@/lib/tools";

const tool = getTool("remove-bg");

function outputExt(file: File): "gif" | "webp" | "png" {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "gif" || file.type === "image/gif") return "gif";
  if (ext === "webp" || file.type === "image/webp") return "webp";
  // Video has no cheap alpha container in the browser; a transparent GIF is the
  // useful answer. Stills come back as PNG so the alpha survives.
  if (file.type.startsWith("video/")) return "gif";
  return "png";
}

const hex = (r: number, g: number, b: number) =>
  "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");

/**
 * ffmpeg's colorkey, in JS, for the live preview: distance from the key colour
 * as a fraction of the RGB diagonal, hard-cut at `similarity`, ramped over
 * `blend` when feathering.
 */
function keyOut(img: ImageData, key: [number, number, number], similarity: number, blend: number) {
  const d = img.data;
  const norm = 255 * Math.sqrt(3);
  for (let i = 0; i < d.length; i += 4) {
    const dr = d[i] - key[0];
    const dg = d[i + 1] - key[1];
    const db = d[i + 2] - key[2];
    const diff = Math.sqrt(dr * dr + dg * dg + db * db) / norm;
    const a =
      blend > 0 ? Math.min(1, Math.max(0, (diff - similarity) / blend)) : diff > similarity ? 1 : 0;
    d[i + 3] = Math.round(d[i + 3] * a);
  }
}

function Body({ file, setBusy, setProgress, setError, publish }: ToolBodyProps) {
  const run = useRun({ setBusy, setError, setProgress });
  // "" = auto: the top-left pixel of the first frame, which is the background
  // in almost every image anyone wants keyed.
  const [color, setColor] = React.useState("");
  const [tolerance, setTolerance] = React.useState(20);
  const [feather, setFeather] = React.useState(5);
  const [picking, setPicking] = React.useState(false);
  const { frame, size, failed } = useFirstFrame(file);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  // Full-resolution copy of the first frame, so the eyedropper reads source pixels.
  const srcRef = React.useRef<OffscreenCanvas | HTMLCanvasElement | null>(null);
  const [auto, setAuto] = React.useState("#ffffff");

  React.useEffect(() => {
    setColor("");
    if (!frame || !size) return;
    const c = document.createElement("canvas");
    c.width = size.w;
    c.height = size.h;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(frame, 0, 0);
    srcRef.current = c;
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    setAuto(hex(r, g, b));
  }, [frame, size]);

  const key = color || auto;
  const rgb: [number, number, number] = [
    parseInt(key.slice(1, 3), 16),
    parseInt(key.slice(3, 5), 16),
    parseInt(key.slice(5, 7), 16),
  ];
  const similarity = Math.max(0.01, tolerance / 100);
  const blend = feather / 100;

  const scale = size ? Math.min(320 / size.w, 320 / size.h, 1) : 1;
  const pw = size ? Math.max(1, Math.round(size.w * scale)) : 0;
  const ph = size ? Math.max(1, Math.round(size.h * scale)) : 0;

  React.useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d", { willReadFrequently: true });
    if (!ctx || !frame || !pw || !ph) return;
    ctx.clearRect(0, 0, pw, ph);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(frame, 0, 0, pw, ph);
    const img = ctx.getImageData(0, 0, pw, ph);
    keyOut(img, rgb, similarity, blend);
    ctx.putImageData(img, 0, 0);
    // rgb is derived from `key`; listing the string keeps the deps stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame, pw, ph, key, similarity, blend]);

  const pick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const src = srcRef.current;
    const rect = e.currentTarget.getBoundingClientRect();
    if (!src || !size) return;
    const x = Math.min(
      size.w - 1,
      Math.max(0, Math.floor(((e.clientX - rect.left) / rect.width) * size.w)),
    );
    const y = Math.min(
      size.h - 1,
      Math.max(0, Math.floor(((e.clientY - rect.top) / rect.height) * size.h)),
    );
    const [r, g, b] = (src.getContext("2d") as CanvasRenderingContext2D).getImageData(
      x,
      y,
      1,
      1,
    ).data;
    setColor(hex(r, g, b));
    setPicking(false);
  };

  const go = () =>
    run("Removing background", async () => {
      if (!file) throw new Error("Choose a GIF or image first.");
      const filters = `colorkey=0x${key.slice(1)}:${similarity.toFixed(3)}:${blend.toFixed(3)}`;
      const ext = outputExt(file);
      const srcExt = file.name.split(".").pop()?.toLowerCase() || "bin";
      const out = await ffmpegOnce(
        file,
        `in.${srcExt}`,
        `out.${ext}`,
        ({ input, output }) =>
          ext === "gif"
            ? paletteGifArgs({ input, output, filters })
            : ext === "webp"
              ? ["-i", input, "-vf", filters, output]
              : ["-i", input, "-vf", filters, "-frames:v", "1", output],
        { onProgress: (r) => setProgress(r) },
      ).catch((err: unknown) => {
        throw new Error(
          `ffmpeg could not key this file (${err instanceof Error ? err.message : String(err)}). Try a different input format.`,
        );
      });
      publish({
        data: out,
        ext,
        note: `${key} ±${tolerance}%${feather ? `, feather ${feather}%` : ""}`,
      });
    });

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <ColorField id="rb-color" label="colour to remove" value={key} onChange={setColor} />
          </div>
          <Button
            variant={picking ? "default" : "outline"}
            size="icon"
            aria-pressed={picking}
            aria-label="Pick the colour from the preview"
            title="Pick from the preview"
            disabled={!frame}
            onClick={() => setPicking((v) => !v)}
          >
            <Pipette aria-hidden="true" />
          </Button>
        </div>
        <p className="self-end text-label text-muted-foreground">
          {color
            ? "Chosen from the image."
            : "Auto: the top-left pixel. Click the preview to pick another."}
        </p>
        <Range
          id="rb-tolerance"
          label="tolerance"
          suffix="%"
          min={1}
          max={100}
          step={1}
          value={tolerance}
          onChange={(e) => setTolerance(Number(e.target.value))}
        />
        <Range
          id="rb-feather"
          label="feather"
          suffix="%"
          min={0}
          max={50}
          step={1}
          value={feather}
          onChange={(e) => setFeather(Number(e.target.value))}
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
              onClick={pick}
              className={`checkerboard border-border block max-w-full border ${picking ? "cursor-crosshair ring-2 ring-primary" : "cursor-crosshair"}`}
              role="img"
              aria-label="First frame with the chosen colour removed"
            />
          </div>
          <p className="text-label text-muted-foreground mt-1">
            First frame only. Click anywhere on it to pick the colour to remove.
          </p>
        </div>
      ) : file && failed ? (
        <p className="text-label text-muted-foreground">{NO_PREVIEW}</p>
      ) : null}

      <Button onClick={go} disabled={!file}>
        Remove background
      </Button>
    </>
  );
}

export default function RemoveBgTool() {
  return (
    <ToolShell
      tool={tool}
      accept="image/gif,image/png,image/jpeg,image/webp,video/*"
      defaultName="transparent"
      hint="Pick the colour to knock out, widen the tolerance until the whole background goes, and add a little feather so edges don't look cut with scissors. GIFs stay animated; stills come back as PNG."
    >
      {(props) => <Body {...props} />}
    </ToolShell>
  );
}
