"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { ColorField, Label, Range, Select } from "@/components/ui/field";
import { ToolShell, useRun, type ToolBodyProps } from "@/components/tool-shell";
import { encodeGif, loadImage, renderFrames } from "@/lib/engines/gif-encode";
import { getTool } from "@/lib/tools";
import { hslToRgb, rgbToHsl } from "@/lib/color";

const tool = getTool("party");

/** The party parrot cycle, in order. */
const PARROT = [
  [255, 109, 109],
  [255, 173, 96],
  [255, 240, 111],
  [149, 232, 116],
  [104, 232, 178],
  [104, 224, 232],
  [104, 165, 232],
  [143, 122, 232],
  [206, 112, 232],
  [255, 112, 178],
] as const;

type Palette = "parrot" | "hsv" | "custom";
type Mode = "all" | "bright";

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

interface Settings {
  size: number;
  frames: number;
  delay: number;
  palette: Palette;
  mode: Mode;
  threshold: number;
  from: string;
  to: string;
  bg: string | null;
}

/** The party colour for frame `i`, as [hue, saturation] plus a t for hue-rotate. */
function frameColor(i: number, s: Settings): [number, number] {
  const t = i / s.frames;
  if (s.palette === "parrot") {
    const [r, g, b] = PARROT[i % PARROT.length];
    const [h, sat] = rgbToHsl(r, g, b);
    return [h, sat];
  }
  if (s.palette === "hsv") return [t, 1];
  // Custom: ping-pong between the two colours so the loop is seamless.
  const f = t < 0.5 ? t * 2 : 2 - t * 2;
  const a = hexToRgb(s.from);
  const b = hexToRgb(s.to);
  const mix = a.map((v, k) => v + (b[k] - v) * f) as [number, number, number];
  const [h, sat] = rgbToHsl(mix[0], mix[1], mix[2]);
  return [h, sat];
}

function drawFrame(ctx: CanvasRenderingContext2D, img: HTMLImageElement, i: number, s: Settings) {
  const { size } = s;
  ctx.globalCompositeOperation = "source-over";
  ctx.clearRect(0, 0, size, size);
  const scale = Math.min(size / img.width, size / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);

  const frame = ctx.getImageData(0, 0, size, size);
  const px = frame.data;
  const [ph, ps] = frameColor(i, s);
  const rotate = s.palette === "hsv" && s.mode === "all";
  const shift = i / s.frames;
  for (let k = 0; k < px.length; k += 4) {
    if (px[k + 3] === 0) continue; // preserve transparency
    const [ph0, ps0, pl] = rgbToHsl(px[k], px[k + 1], px[k + 2]);
    let out: [number, number, number];
    if (rotate) {
      out = hslToRgb((ph0 + shift) % 1, ps0, pl);
    } else if (s.mode === "bright") {
      if (pl < s.threshold / 100) continue; // dark line art keeps its structure
      out = hslToRgb(ph, Math.max(ps, 0.5), pl);
    } else {
      // Compress lightness so flat white areas take the colour instead of staying white.
      out = hslToRgb(ph, Math.max(ps, 0.5), 0.15 + pl * 0.62);
    }
    px[k] = out[0];
    px[k + 1] = out[1];
    px[k + 2] = out[2];
  }
  ctx.putImageData(frame, 0, 0);

  if (s.bg) {
    ctx.globalCompositeOperation = "destination-over";
    ctx.fillStyle = s.bg;
    ctx.fillRect(0, 0, size, size);
    ctx.globalCompositeOperation = "source-over";
  }
}

function Body({ file, setBusy, setProgress, setError, publish }: ToolBodyProps) {
  const run = useRun({ setBusy, setError, setProgress });
  const [size, setSize] = React.useState(128);
  const [frames, setFrames] = React.useState(10);
  const [delay, setDelay] = React.useState(60);
  const [palette, setPalette] = React.useState<Palette>("parrot");
  const [mode, setMode] = React.useState<Mode>("all");
  const [threshold, setThreshold] = React.useState(45);
  const [from, setFrom] = React.useState("#ff2d95");
  const [to, setTo] = React.useState("#00e5ff");
  const [bgMode, setBgMode] = React.useState<"transparent" | "color">("transparent");
  const [bg, setBg] = React.useState("#ffffff");
  const [img, setImg] = React.useState<HTMLImageElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  const settings: Settings = {
    size,
    frames,
    delay,
    palette,
    mode,
    threshold,
    from,
    to,
    bg: bgMode === "color" ? bg : null,
  };

  React.useEffect(() => {
    // Clear first, always: a new pick that fails to decode used to leave the
    // previous image on the canvas, and `go()` would then encode that one under
    // the new file's name.
    setImg(null);
    if (!file) return;
    let live = true;
    loadImage(file)
      .then((i) => live && setImg(i))
      .catch(
        () =>
          live && setError("That file could not be decoded. Try a PNG, JPEG, GIF or WebP."),
      );
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
  }, [img, size, frames, delay, palette, mode, threshold, from, to, bgMode, bg]);

  const go = () =>
    run("Partying", async () => {
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
        note: `${size}px · ${frames}f · ${delay}ms · ${palette} · ${mode}`,
      });
      setProgress(1);
    });

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="party-size">output size</Label>
          <Select id="party-size" value={size} onChange={(e) => setSize(Number(e.target.value))}>
            <option value={32}>32 × 32</option>
            <option value={64}>64 × 64</option>
            <option value={128}>128 × 128 — Slack emoji</option>
            <option value={256}>256 × 256</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="party-palette">palette</Label>
          <Select
            id="party-palette"
            value={palette}
            onChange={(e) => setPalette(e.target.value as Palette)}
          >
            <option value="parrot">Party parrot rainbow</option>
            <option value="hsv">Full HSV sweep</option>
            <option value="custom">Custom two-colour gradient</option>
          </Select>
        </div>
      </div>

      {palette === "custom" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <ColorField id="party-from" label="from colour" value={from} onChange={setFrom} />
          <ColorField id="party-to" label="to colour" value={to} onChange={setTo} />
        </div>
      ) : null}

      <div>
        <Label htmlFor="party-mode">recolour mode</Label>
        <Select id="party-mode" value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
          <option value="all">
            Whole image{palette === "hsv" ? " — hue rotate" : " — take the party colour"}
          </option>
          <option value="bright">Bright areas only — keep dark line art</option>
        </Select>
      </div>

      {mode === "bright" ? (
        <Range
          label="brightness threshold"
          suffix="%"
          min={5}
          max={95}
          step={5}
          value={threshold}
          onChange={(e) => setThreshold(Number(e.target.value))}
        />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Range
          label="frames"
          min={2}
          max={24}
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
          <Label htmlFor="party-bg">background</Label>
          <Select
            id="party-bg"
            value={bgMode}
            onChange={(e) => setBgMode(e.target.value as "transparent" | "color")}
          >
            <option value="transparent">Transparent</option>
            <option value="color">Solid colour</option>
          </Select>
        </div>
        {bgMode === "color" ? (
          <ColorField id="party-bg-color" label="colour" value={bg} onChange={setBg} />
        ) : null}
      </div>

      <div>
        <Label>preview</Label>
        <div
          className={`flex items-center justify-center border border-border p-4 ${
            bgMode === "transparent" ? "checkerboard" : ""
          }`}
        >
          {img ? (
            <canvas
              ref={canvasRef}
              width={size}
              height={size}
              role="img"
              aria-label="Live preview of the party emoji"
              style={{ width: 128, height: 128, imageRendering: size < 128 ? "pixelated" : "auto" }}
            />
          ) : (
            <p className="text-ui text-muted-foreground py-8">Choose an image to preview.</p>
          )}
        </div>
      </div>

      <Button onClick={go} disabled={!file}>
        Party it up
      </Button>
    </>
  );
}

export default function PartyTool() {
  return (
    <ToolShell
      tool={tool}
      accept="image/png,image/jpeg,image/webp,image/gif"
      defaultName="party"
      hint="Every frame recolours the pixels directly, so transparency survives. Line art usually looks best with bright areas only."
    >
      {(props) => <Body {...props} />}
    </ToolShell>
  );
}
