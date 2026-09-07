"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, ColorField, Input, Label, Range, Select } from "@/components/ui/field";
import { ToolShell, useRun, type ToolBodyProps } from "@/components/tool-shell";
import { encodeGif, renderFrames } from "@/lib/engines/gif-encode";
import { getTool } from "@/lib/tools";
import { inkMetrics } from "@/lib/utils";

const tool = getTool("number");

// Heavy sans; the exact face depends on the viewer's OS (Impact on Windows,
// Arial Black elsewhere). All of them are condensed enough to read at 22px.
const FONT = 'Impact, "Arial Black", "Helvetica Neue", Arial, sans-serif';

interface Style {
  fill: string;
  fill2: string;
  stroke: string;
  glow: boolean;
}

const PRESETS: { id: string; label: string; style: Style }[] = [
  {
    id: "classic",
    label: "classic 100",
    style: { fill: "#dd2e44", fill2: "#dd2e44", stroke: "", glow: false },
  },
  {
    id: "gold",
    label: "gold",
    style: { fill: "#ffd76b", fill2: "#c07a06", stroke: "#40260a", glow: false },
  },
  {
    id: "neon",
    label: "neon",
    style: { fill: "#4dfff0", fill2: "#4dfff0", stroke: "", glow: true },
  },
  {
    id: "outlined",
    label: "outlined",
    style: { fill: "#ffffff", fill2: "#ffffff", stroke: "#101418", glow: false },
  },
  {
    id: "sunset",
    label: "gradient",
    style: { fill: "#ffb02e", fill2: "#ff2e88", stroke: "", glow: false },
  },
];

type Underline = "none" | "single" | "double";
type Anim = "pulse" | "shake" | "rainbow";

interface Opts extends Style {
  text: string;
  italic: boolean;
  underline: Underline;
  thick: number;
  bg: string;
  transparent: boolean;
  anim: Anim | null;
}

/** Draw one frame. `t` is 0..1 through the animation loop. */
function draw(ctx: CanvasRenderingContext2D, S: number, o: Opts, t: number) {
  ctx.clearRect(0, 0, S, S);
  if (!o.transparent) {
    ctx.fillStyle = o.bg;
    ctx.fillRect(0, 0, S, S);
  }

  const text = o.text.trim() || "100";
  const margin = S * 0.07;
  const inner = S - margin * 2;
  const th = Math.max(1, (o.thick * S) / 128);
  const uBlock = o.underline === "none" ? 0 : o.underline === "single" ? th : th * 3;
  const uSpace = uBlock ? uBlock + S * 0.07 : 0;
  const textH = Math.max(1, inner - uSpace);
  const font = (px: number) => `${o.italic ? "italic " : ""}900 ${px}px ${FONT}`;

  // Auto-fit: measure at a reference size, then scale down to the tighter of
  // the width and height budgets so 4-digit numbers never clip.
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = font(100);
  const ref = ctx.measureText(text);
  const rw = inkMetrics(ref).w;
  const rh = Math.max(1, ref.actualBoundingBoxAscent + ref.actualBoundingBoxDescent);
  const fs = Math.max(1, 100 * Math.min(inner / rw, textH / rh));
  ctx.font = font(fs);
  const m = ctx.measureText(text);
  const asc = m.actualBoundingBoxAscent;
  const desc = m.actualBoundingBoxDescent;
  const { w: tw, dx } = inkMetrics(m);

  ctx.save();
  ctx.translate(S / 2, margin + textH / 2);
  if (o.anim === "pulse") {
    const s = 1 + 0.07 * Math.sin(t * 2 * Math.PI);
    ctx.scale(s, s);
  }
  if (o.anim === "shake") {
    ctx.translate(Math.sin(t * 4 * Math.PI) * S * 0.022, Math.cos(t * 6 * Math.PI) * S * 0.016);
  }

  let paint: string | CanvasGradient;
  if (o.anim === "rainbow") {
    paint = `hsl(${Math.round(t * 360)} 92% 55%)`;
  } else if (o.fill2 !== o.fill) {
    const g = ctx.createLinearGradient(0, -textH / 2, 0, textH / 2);
    g.addColorStop(0, o.fill);
    g.addColorStop(1, o.fill2);
    paint = g;
  } else {
    paint = o.fill;
  }

  if (o.glow) {
    ctx.shadowColor = o.anim === "rainbow" ? (paint as string) : o.fill;
    ctx.shadowBlur = fs * (o.anim === "pulse" ? 0.18 + 0.12 * Math.sin(t * 2 * Math.PI) : 0.24);
  }

  const y = (asc - desc) / 2;
  if (o.stroke) {
    ctx.lineJoin = "round";
    ctx.lineWidth = fs * 0.1;
    ctx.strokeStyle = o.stroke;
    ctx.strokeText(text, -dx, y);
  }
  ctx.fillStyle = paint;
  ctx.fillText(text, -dx, y);

  if (uBlock) {
    const ux = Math.min(tw, inner) / 2;
    let uy = textH / 2 + S * 0.05;
    const bar = () => {
      if (o.stroke) {
        ctx.lineWidth = fs * 0.1;
        ctx.strokeStyle = o.stroke;
        ctx.strokeRect(-ux, uy, ux * 2, th);
      }
      ctx.fillRect(-ux, uy, ux * 2, th);
    };
    bar();
    if (o.underline === "double") {
      uy += th * 2;
      bar();
    }
  }
  ctx.restore();
  ctx.shadowBlur = 0;
}

function Body({
  setBusy,
  setProgress,
  setError,
  publish,
  text,
  setText,
  format,
  setFormat,
}: ToolBodyProps & {
  text: string;
  setText: (v: string) => void;
  format: "png" | "gif";
  setFormat: (v: "png" | "gif") => void;
}) {
  const run = useRun({ setBusy, setError, setProgress });
  const [preset, setPreset] = React.useState("classic");
  const [style, setStyle] = React.useState<Style>(PRESETS[0].style);
  const [italic, setItalic] = React.useState(true);
  const [underline, setUnderline] = React.useState<Underline>("double");
  const [thick, setThick] = React.useState(9);
  const [size, setSize] = React.useState(128);
  const [transparent, setTransparent] = React.useState(true);
  const [bg, setBg] = React.useState("#ffffff");
  const [anim, setAnim] = React.useState<Anim>("pulse");

  const opts: Opts = {
    ...style,
    text,
    italic,
    underline,
    thick,
    bg,
    transparent,
    anim: format === "gif" ? anim : null,
  };
  const optsRef = React.useRef(opts);
  optsRef.current = opts;

  const big = React.useRef<HTMLCanvasElement>(null);
  const small = React.useRef<HTMLCanvasElement>(null);

  // Live preview. Static when the user prefers reduced motion or wants a PNG.
  React.useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const animate = format === "gif" && !reduced;
    let raf = 0;
    const paint = (now: number) => {
      const t = animate ? (now / 1200) % 1 : 0;
      for (const ref of [big, small]) {
        const ctx = ref.current?.getContext("2d");
        if (ctx) draw(ctx, size, optsRef.current, t);
      }
      if (animate) raf = requestAnimationFrame(paint);
    };
    paint(0);
    return () => cancelAnimationFrame(raf);
  }, [size, format, anim, text, style, italic, underline, thick, transparent, bg]);

  const go = () =>
    run("Rendering", async () => {
      if (!text.trim()) throw new Error("Type a number or short label to render first.");
      const o = optsRef.current;
      if (format === "png") {
        const c = document.createElement("canvas");
        c.width = c.height = size;
        const ctx = c.getContext("2d");
        if (!ctx) throw new Error("Your browser blocked the 2D canvas this tool needs.");
        draw(ctx, size, { ...o, anim: null }, 0);
        setProgress(0.6);
        const blob = await new Promise<Blob | null>((res) => c.toBlob(res, "image/png"));
        if (!blob) throw new Error("The browser could not encode the PNG. Try a smaller size.");
        publish({
          data: new Uint8Array(await blob.arrayBuffer()),
          ext: "png",
          mime: "image/png",
          note: `${size}px ${preset}`,
        });
      } else {
        const frames = renderFrames({ width: size, height: size }, 16, (ctx, t) =>
          draw(ctx, size, o, t),
        );
        setProgress(0.7);
        publish({
          data: encodeGif(frames, { delayMs: 70, transparent, maxColors: 128 }),
          ext: "gif",
          note: `${size}px ${preset} ${anim}`,
        });
      }
      setProgress(1);
    });

  const applyPreset = (p: (typeof PRESETS)[number]) => {
    setPreset(p.id);
    setStyle(p.style);
  };

  return (
    <>
      <div>
        <Label htmlFor="num-text">number or short label</Label>
        <Input
          id="num-text"
          value={text}
          maxLength={6}
          spellCheck={false}
          onChange={(e) => setText(e.target.value)}
          aria-describedby="num-text-hint"
        />
        <p id="num-text-hint" className="text-label text-muted-foreground mt-1">
          Up to 6 characters. Longer values shrink to fit the square.
        </p>
      </div>

      <fieldset>
        <legend className="text-label text-muted-foreground tracking-[1.5px] uppercase mb-1">
          style preset
        </legend>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <Button
              key={p.id}
              type="button"
              size="sm"
              variant={preset === p.id ? "default" : "outline"}
              aria-pressed={preset === p.id}
              onClick={() => applyPreset(p)}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <ColorField
          id="num-fill"
          label="colour"
          value={style.fill}
          onChange={(v) => {
            setStyle((s) => ({ ...s, fill: v, fill2: v }));
            setPreset("custom");
          }}
        />
        <div>
          <Label htmlFor="num-underline">underline</Label>
          <Select
            id="num-underline"
            value={underline}
            onChange={(e) => setUnderline(e.target.value as Underline)}
          >
            <option value="none">none</option>
            <option value="single">single</option>
            <option value="double">double — the 100 look</option>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {underline !== "none" ? (
          <Range
            label="underline thickness"
            min={3}
            max={20}
            value={thick}
            suffix="px"
            onChange={(e) => setThick(Number(e.target.value))}
          />
        ) : (
          <div />
        )}
        <div>
          <Label htmlFor="num-size">size</Label>
          <Select id="num-size" value={size} onChange={(e) => setSize(Number(e.target.value))}>
            <option value={64}>64 × 64</option>
            <option value={128}>128 × 128 — Slack</option>
            <option value={256}>256 × 256</option>
          </Select>
        </div>
      </div>

      <div className="grid gap-3">
        <Checkbox label="Italic" checked={italic} onChange={(e) => setItalic(e.target.checked)} />
        <Checkbox
          label="Transparent background"
          checked={transparent}
          onChange={(e) => setTransparent(e.target.checked)}
        />
        {!transparent ? (
          <ColorField id="num-bg" label="background colour" value={bg} onChange={setBg} />
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="num-format">output</Label>
          <Select
            id="num-format"
            value={format}
            onChange={(e) => setFormat(e.target.value as "png" | "gif")}
          >
            <option value="gif">animated GIF</option>
            <option value="png">static PNG</option>
          </Select>
        </div>
        {format === "gif" ? (
          <div>
            <Label htmlFor="num-anim">animation</Label>
            <Select id="num-anim" value={anim} onChange={(e) => setAnim(e.target.value as Anim)}>
              <option value="pulse">pulse / glow</option>
              <option value="shake">shake</option>
              <option value="rainbow">rainbow cycle</option>
            </Select>
          </div>
        ) : null}
      </div>

      <div>
        <Label>live preview</Label>
        <div className="flex items-center gap-4 border border-border p-3">
          <div className="checkerboard shrink-0 border border-border">
            <canvas
              ref={big}
              width={size}
              height={size}
              className="block size-32"
              role="img"
              aria-label={`Preview of ${text || "100"} in the ${preset} style`}
            />
          </div>
          <div className="min-w-0">
            <div
              className="checkerboard inline-block border border-border"
              style={{ "--checker-size": "8px" } as React.CSSProperties}
            >
              <canvas
                ref={small}
                width={size}
                height={size}
                className="block size-[22px]"
                aria-hidden="true"
              />
            </div>
            <p className="text-label text-muted-foreground mt-1">actual Slack size (22px)</p>
          </div>
        </div>
      </div>

      <Button onClick={go}>Generate {format === "gif" ? "GIF" : "PNG"}</Button>
    </>
  );
}

export default function NumberTool() {
  // Held here so the download name and its extension can track the controls.
  const [text, setText] = React.useState("100");
  const [format, setFormat] = React.useState<"png" | "gif">("gif");
  return (
    <ToolShell
      tool={tool}
      requiresFile={false}
      defaultName="number"
      suggestedName={text}
      suggestedExt={format}
      hint="Type a number, pick a style and download it. The text auto-shrinks to fit the square, so 1000 works as well as 100."
    >
      {(props) => (
        <Body {...props} text={text} setText={setText} format={format} setFormat={setFormat} />
      )}
    </ToolShell>
  );
}
