"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, ColorField, Input, Label, Range, Select } from "@/components/ui/field";
import { ToolShell, useAutoRun, useRun, type ToolBodyProps } from "@/components/tool-shell";
import { encodeGif, renderFrames } from "@/lib/engines/gif-encode";
import { BRUSH, SANS, useBrushFont } from "@/lib/brush-font";
import { getTool } from "@/lib/tools";
import { inkMetrics } from "@/lib/utils";

const tool = getTool("text-emoji");

// Heavy sans; the exact face depends on the viewer's OS (Impact on Windows,
// Arial Black elsewhere). All of them stay legible at Slack's 22px.

interface Style {
  fill: string;
  fill2: string;
  bg: string;
  transparent: boolean;
  stroke: string;
  stroke2: string;
  strokeW: number;
  italic: boolean;
  glow: boolean;
  shadow: boolean;
  brush?: boolean;
}

const base: Style = {
  fill: "#ffffff",
  fill2: "#ffffff",
  bg: "#000000",
  transparent: true,
  stroke: "#12161c",
  stroke2: "",
  strokeW: 8,
  italic: false,
  glow: false,
  shadow: false,
};

const PRESETS: { id: string; label: string; style: Style }[] = [
  {
    id: "sunset",
    label: "sunset",
    style: { ...base, fill: "#ffb02e", fill2: "#ff2e88", stroke: "#2a0d1e", strokeW: 7 },
  },
  { id: "classic", label: "classic", style: { ...base } },
  {
    id: "caution",
    label: "caution",
    style: {
      ...base,
      fill: "#101010",
      fill2: "#101010",
      bg: "#ffd400",
      transparent: false,
      stroke: "",
      strokeW: 0,
    },
  },
  {
    id: "alert",
    label: "alert",
    style: { ...base, bg: "#d7263d", transparent: false, stroke: "", strokeW: 0 },
  },
  {
    id: "go",
    label: "go",
    style: { ...base, bg: "#2b9348", transparent: false, stroke: "", strokeW: 0 },
  },
  {
    id: "neon",
    label: "neon",
    style: {
      ...base,
      fill: "#4dfff0",
      fill2: "#4dfff0",
      bg: "#0d1117",
      transparent: false,
      stroke: "",
      strokeW: 0,
      glow: true,
    },
  },
  {
    id: "blueprint",
    label: "blueprint",
    style: { ...base, bg: "#1f6feb", transparent: false, stroke: "", strokeW: 0, italic: true },
  },
  {
    id: "bubblegum",
    label: "bubblegum",
    style: {
      ...base,
      fill: "#ff5fcf",
      fill2: "#c04cff",
      stroke: "#4fb3ff",
      stroke2: "#2f7de1",
      strokeW: 9,
    },
  },
  {
    id: "sticker",
    label: "sticker",
    style: {
      ...base,
      fill: "#ff3b6b",
      fill2: "#ff3b6b",
      stroke: "#ffffff",
      strokeW: 14,
      shadow: true,
    },
  },
  {
    id: "ink",
    label: "ink",
    style: { ...base, fill: "#101010", fill2: "#101010", stroke: "#ffffff", strokeW: 10 },
  },
];

const ANIMS = ["pulse", "shake", "rainbow"] as const;
type Anim = (typeof ANIMS)[number];

interface Opts extends Style {
  text: string;
  lines: number;
  anims: Anim[];
}

/** A typed `\n` (or a real newline) forces a line break and overrides the line count. */
function forcedLines(text: string): string[] | null {
  const parts = text.split(/\\n|\n/).map((s) => s.trim());
  return parts.length > 1 ? parts.filter(Boolean) : null;
}

/** Split a phrase across n lines, keeping the lines roughly equal in length. */
function splitLines(text: string, n: number): string[] {
  const forced = forcedLines(text);
  if (forced) return forced.length ? forced : [""];
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  if (n <= 1 || words.length === 1) return [words.join(" ")];
  if (n >= words.length) return words;
  const target = words.join("").length / n;
  const out: string[] = [];
  let cur: string[] = [];
  words.forEach((w, i) => {
    cur.push(w);
    const left = words.length - i - 1;
    const need = n - out.length - 1;
    if (out.length < n - 1 && (cur.join("").length >= target || left <= need) && left >= need) {
      out.push(cur.join(" "));
      cur = [];
    }
  });
  if (cur.length) out.push(cur.join(" "));
  return out;
}

/** Auto line count: one word per line up to three lines. */
function autoLines(text: string): number {
  const forced = forcedLines(text);
  if (forced) return Math.max(1, forced.length);
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.min(3, Math.max(1, words));
}

/** Draw one frame. `t` is 0..1 through the animation loop. */
function draw(ctx: CanvasRenderingContext2D, S: number, o: Opts, t: number) {
  ctx.clearRect(0, 0, S, S);
  if (!o.transparent) {
    ctx.fillStyle = o.bg;
    ctx.fillRect(0, 0, S, S);
  }
  const lines = splitLines(o.text || "yes", o.lines);
  const margin = S * 0.06;
  const inner = S - margin * 2;
  const gap = inner * 0.03;
  const budget = (inner - gap * (lines.length - 1)) / lines.length;
  const font = (px: number) => `${o.italic ? "italic " : ""}900 ${px}px ${o.brush ? BRUSH : SANS}`;

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  // Per line: the font size that fills the width, capped by the height each
  // line is allowed. Then stretch horizontally so every line fills the square.
  const laid = lines.map((line) => {
    ctx.font = font(100);
    const m = ctx.measureText(line || " ");
    const w = inkMetrics(m).w;
    const h = Math.max(1, m.actualBoundingBoxAscent + m.actualBoundingBoxDescent);
    const fs = Math.max(1, 100 * Math.min(inner / w, budget / h));
    ctx.font = font(fs);
    const m2 = ctx.measureText(line || " ");
    const ink = inkMetrics(m2);
    return {
      line,
      fs,
      w: ink.w,
      dx: ink.dx,
      asc: m2.actualBoundingBoxAscent,
      desc: m2.actualBoundingBoxDescent,
    };
  });

  const total = laid.reduce((a, l) => a + l.asc + l.desc, 0) + gap * (lines.length - 1);
  let y = margin + (inner - total) / 2;

  ctx.save();
  ctx.translate(S / 2, S / 2);
  if (o.anims.includes("pulse")) {
    const s = 1 + 0.06 * Math.sin(t * 2 * Math.PI);
    ctx.scale(s, s);
  }
  if (o.anims.includes("shake")) {
    ctx.translate(Math.sin(t * 4 * Math.PI) * S * 0.02, Math.cos(t * 6 * Math.PI) * S * 0.015);
  }
  ctx.translate(-S / 2, -S / 2);

  // Top-to-bottom gradient across the whole block when the two colours differ.
  // Gradient coordinates are read in the transform current at paint time, so
  // each line builds its own, shifted by its baseline `y`.
  const grad = (a: string, b: string, y: number) => {
    if (!b || a === b) return a;
    const g = ctx.createLinearGradient(0, margin - y, 0, margin + inner - y);
    g.addColorStop(0, a);
    g.addColorStop(1, b);
    return g;
  };
  const rainbow = o.anims.includes("rainbow") ? `hsl(${Math.round(t * 360)} 92% 58%)` : null;

  for (const l of laid) {
    y += l.asc;
    ctx.save();
    ctx.translate(S / 2, y);
    // Cap the stretch so a one- or two-letter line doesn't smear.
    ctx.scale(Math.min(1.5, inner / l.w), 1);
    ctx.font = font(l.fs);
    const paint = rainbow ?? grad(o.fill, o.fill2, y);
    const strokePaint = grad(o.stroke || "#000000", o.stroke2, y);
    if (o.glow) {
      ctx.shadowColor = rainbow ?? o.fill;
      ctx.shadowBlur = l.fs * 0.25;
    } else if (o.shadow) {
      ctx.shadowColor = "rgba(0,0,0,0.35)";
      ctx.shadowBlur = l.fs * 0.12;
      ctx.shadowOffsetY = l.fs * 0.06;
    }
    // Thickness alone decides whether there is an outline. Presets leave stroke
    // empty, and the colour field already shows black as the standing default,
    // so keying off the colour made the thickness slider a no-op after a preset.
    if (o.strokeW > 0) {
      ctx.lineJoin = "round";
      ctx.lineWidth = (l.fs * o.strokeW) / 100;
      ctx.strokeStyle = strokePaint;
      ctx.strokeText(l.line, -l.dx, 0);
    }
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = paint;
    ctx.fillText(l.line, -l.dx, 0);
    ctx.restore();
    y += l.desc + gap;
  }
  ctx.restore();
}

function Body({
  setBusy,
  setProgress,
  setError,
  publish,
  text,
  setText,
  anims,
  setAnims,
}: ToolBodyProps & {
  text: string;
  setText: (v: string) => void;
  anims: Anim[];
  setAnims: (v: Anim[]) => void;
}) {
  const run = useRun({ setBusy, setError, setProgress });
  const format = anims.length ? "gif" : "png";
  const [preset, setPreset] = React.useState("sunset");
  const [style, setStyle] = React.useState<Style>(PRESETS[0].style);
  const [lineMode, setLineMode] = React.useState("auto");
  const [size, setSize] = React.useState(128);

  const lines = lineMode === "auto" ? autoLines(text) : Number(lineMode);
  const opts: Opts = { ...style, text, lines, anims };
  const optsRef = React.useRef(opts);
  optsRef.current = opts;

  const go = () =>
    run("Rendering", async () => {
      if (!text.trim()) throw new Error("Type a word or short phrase to render first.");
      const o = optsRef.current;
      if (format === "png") {
        const c = document.createElement("canvas");
        c.width = c.height = size;
        const ctx = c.getContext("2d");
        if (!ctx) throw new Error("Your browser blocked the 2D canvas this tool needs.");
        draw(ctx, size, { ...o, anims: [] }, 0);
        setProgress(0.6);
        const blob = await new Promise<Blob | null>((res) => c.toBlob(res, "image/png"));
        if (!blob) throw new Error("The browser could not encode the PNG. Try a smaller size.");
        publish({
          data: new Uint8Array(await blob.arrayBuffer()),
          ext: "png",
          mime: "image/png",
          note: `${size}px ${preset} ${lines} line(s)`,
        });
      } else {
        const frames = renderFrames({ width: size, height: size }, 16, (ctx, t) =>
          draw(ctx, size, o, t),
        );
        setProgress(0.7);
        publish({
          data: encodeGif(frames, { delayMs: 70, transparent: style.transparent, maxColors: 128 }),
          ext: "gif",
          note: `${size}px ${preset} ${anims.join("+") || "static"}`,
        });
      }
      setProgress(1);
    });

  const set = <K extends keyof Style>(k: K, v: Style[K]) => {
    setStyle((s) => ({ ...s, [k]: v }));
    setPreset("custom");
  };

  const fontReady = useBrushFont();
  useAutoRun(go, [text, format, style, lineMode, size, anims], fontReady);
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="te-text">phrase</Label>
          <Input
            id="te-text"
            value={text}
            maxLength={40}
            spellCheck={false}
            onChange={(e) => setText(e.target.value)}
            aria-describedby="te-text-hint"
          />
          <p id="te-text-hint" className="text-label text-muted-foreground mt-1">
            Short is best — each line is stretched to fill the square. Type \n to force a line
            break.
          </p>
        </div>
        <div>
          <Label htmlFor="te-lines">lines</Label>
          <Select id="te-lines" value={lineMode} onChange={(e) => setLineMode(e.target.value)}>
            <option value="auto">auto ({lines})</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
          </Select>
        </div>
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
              onClick={() => {
                setPreset(p.id);
                setStyle(p.style);
              }}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <ColorField
          id="te-fill"
          label="text colour"
          value={style.fill}
          // The bottom colour follows the top one until it is set on its own.
          onChange={(v) =>
            setStyle((s) => ({ ...s, fill: v, fill2: s.fill2 === s.fill ? v : s.fill2 }))
          }
        />
        <ColorField
          id="te-fill2"
          label="text colour (bottom)"
          value={style.fill2}
          onChange={(v) => set("fill2", v)}
        />
        <ColorField
          id="te-stroke"
          label="outline colour"
          value={style.stroke || "#000000"}
          onChange={(v) =>
            setStyle((s) => ({
              ...s,
              stroke: v,
              stroke2: !s.stroke2 || s.stroke2 === s.stroke ? v : s.stroke2,
            }))
          }
        />
        <ColorField
          id="te-stroke2"
          label="outline colour (bottom)"
          value={style.stroke2 || style.stroke || "#000000"}
          onChange={(v) => set("stroke2", v)}
        />
      </div>

      <Range
        label="outline thickness"
        min={0}
        max={20}
        value={style.strokeW}
        onChange={(e) => set("strokeW", Number(e.target.value))}
      />

      <div className="grid gap-3">
        <ColorField
          id="te-bg"
          label="background colour"
          value={style.transparent ? "" : style.bg}
          onChange={(v) => {
            setStyle((s) => ({ ...s, transparent: !v, bg: v || s.bg }));
            setPreset("custom");
          }}
          clearable
        />
        <Checkbox
          label="Italic"
          checked={style.italic}
          onChange={(e) => set("italic", e.target.checked)}
        />
        <Checkbox
          label="Glow"
          checked={style.glow}
          onChange={(e) => set("glow", e.target.checked)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="te-font">typeface</Label>
          <Select
            id="te-font"
            value={style.brush ? "brush" : "sans"}
            onChange={(e) => setStyle((s) => ({ ...s, brush: e.target.value === "brush" }))}
          >
            <option value="sans">Impact — heavy sans</option>
            <option value="brush">Knewave — hand-drawn brush</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="te-size">size</Label>
          <Select id="te-size" value={size} onChange={(e) => setSize(Number(e.target.value))}>
            <option value={64}>64 × 64</option>
            <option value={128}>128 × 128 — Slack</option>
            <option value={256}>256 × 256</option>
          </Select>
        </div>
      </div>

      <div>
        <Label>animation</Label>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {ANIMS.map((a) => (
            <Checkbox
              key={a}
              label={a}
              checked={anims.includes(a)}
              onChange={(e) =>
                setAnims(e.target.checked ? [...anims, a] : anims.filter((x) => x !== a))
              }
            />
          ))}
        </div>
        <p className="text-label text-muted-foreground mt-1">
          Tick any to get an animated GIF; none gives a static PNG.
        </p>
      </div>
    </>
  );
}

export default function TextEmojiTool() {
  // Held here so the download name and its extension can track the controls.
  const [text, setText] = React.useState("hell yeah");
  const [anims, setAnims] = React.useState<Anim[]>([]);
  const format = anims.length ? "gif" : "png";
  return (
    <ToolShell
      tool={tool}
      requiresFile={false}
      defaultName="text-emoji"
      suggestedName={text}
      suggestedExt={format}
      hint='Slack shows emoji at about 22px, so words are stacked and stretched to fill the square — "hell yeah" becomes HELL over YEAH.'
    >
      {(props) => (
        <Body {...props} text={text} setText={setText} anims={anims} setAnims={setAnims} />
      )}
    </ToolShell>
  );
}
