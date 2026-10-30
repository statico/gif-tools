"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, ColorField, Input, Label, Range, Select } from "@/components/ui/field";
import { ToolShell, useAutoRun, useRun, type ToolBodyProps } from "@/components/tool-shell";
import { encodeGif, renderFrames } from "@/lib/engines/gif-encode";
import { Shuffle } from "lucide-react";
import { FACES, FACE_IDS, faceOptions, useFace, type FaceId } from "@/lib/fonts";
import { getTool } from "@/lib/tools";
import { inkMetrics, slugify } from "@/lib/utils";
import { zipSync } from "fflate";

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

const ANIMS = ["pulse", "shake", "rainbow", "wave", "shine"] as const;
type Anim = (typeof ANIMS)[number];

const LAYOUTS = {
  stack: "one emoji — stacked lines",
  tiles: "tiles — banner cut into squares",
  marquee: "marquee — scrolling GIF",
} as const;
type Layout = keyof typeof LAYOUTS;

interface Opts extends Style {
  text: string;
  lines: number;
  anims: Anim[];
  face: FaceId;
}

const fontOf = (o: Opts, px: number) =>
  `${o.italic ? "italic " : ""}900 ${px}px ${FACES[o.face].family}`;

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

/** One run of text, positioned on the canvas. */
interface Placed {
  line: string;
  fs: number;
  /** Horizontal stretch. */
  sx: number;
  /** Ink-centring offset at `fs`, before the stretch. */
  dx: number;
  /** Centre x and baseline y. */
  x: number;
  y: number;
  /** Vertical span the two-colour gradient runs over. */
  top: number;
  bottom: number;
  /** Index of the run's first letter in the whole phrase, so a wave carries on down the lines. */
  idx: number;
}

/** Stacked lines, each stretched to fill the square. */
function stackLayout(ctx: CanvasRenderingContext2D, S: number, o: Opts): Placed[] {
  const lines = splitLines(o.text || "yes", o.lines);
  const margin = S * 0.06;
  const inner = S - margin * 2;
  const gap = inner * 0.03;
  const budget = (inner - gap * (lines.length - 1)) / lines.length;
  // Per line: the font size that fills the width, capped by the height each
  // line is allowed. Then stretch horizontally so every line fills the square.
  const laid = lines.map((line) => {
    ctx.font = fontOf(o, 100);
    const m = ctx.measureText(line || " ");
    const w = inkMetrics(m).w;
    const h = Math.max(1, m.actualBoundingBoxAscent + m.actualBoundingBoxDescent);
    const fs = Math.max(1, 100 * Math.min(inner / w, budget / h));
    ctx.font = fontOf(o, fs);
    const m2 = ctx.measureText(line || " ");
    const ink = inkMetrics(m2);
    // Cap the stretch so a one- or two-letter line doesn't smear.
    const sx = Math.min(1.5, inner / ink.w);
    return {
      line,
      fs,
      sx,
      dx: ink.dx,
      asc: m2.actualBoundingBoxAscent,
      desc: m2.actualBoundingBoxDescent,
    };
  });
  const total = laid.reduce((a, l) => a + l.asc + l.desc, 0) + gap * (lines.length - 1);
  let y = margin + (inner - total) / 2;
  let idx = 0;
  return laid.map((l) => {
    y += l.asc;
    const p = { ...l, x: S / 2, y, top: margin, bottom: margin + inner, idx };
    y += l.desc + gap;
    idx += Array.from(l.line).length;
    return p;
  });
}

/** A single line, vertically centred in an S-tall row at `scale` of full height. */
function rowMetrics(ctx: CanvasRenderingContext2D, S: number, o: Opts, scale = 1) {
  const margin = S * 0.06;
  const inner = S - margin * 2;
  ctx.font = fontOf(o, 100);
  const m = ctx.measureText(o.text);
  const h = Math.max(1, m.actualBoundingBoxAscent + m.actualBoundingBoxDescent);
  const k = (inner / h) * scale;
  const y = (S - h * k) / 2 + m.actualBoundingBoxAscent * k;
  return {
    fs: 100 * k,
    margin,
    y,
    top: y - m.actualBoundingBoxAscent * k,
    bottom: y + m.actualBoundingBoxDescent * k,
  };
}

/**
 * Draw one W×H frame (square, or the whole strip of tiles). `t` is 0..1
 * through the loop; looping effects repeat `cycles` times.
 */
function paint(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  o: Opts,
  t: number,
  placed: Placed[],
  cycles = 1,
) {
  ctx.clearRect(0, 0, W, H);
  const c = t * cycles;
  ctx.save();
  ctx.translate(W / 2, H / 2);
  if (o.anims.includes("pulse")) {
    const s = 1 + 0.06 * Math.sin(c * 2 * Math.PI);
    ctx.scale(s, s);
  }
  if (o.anims.includes("shake")) {
    ctx.translate(Math.sin(c * 4 * Math.PI) * H * 0.02, Math.cos(c * 6 * Math.PI) * H * 0.015);
  }
  ctx.translate(-W / 2, -H / 2);

  // Gradient coordinates are read in the transform current at paint time, so
  // each run builds its own, shifted by its baseline `y`.
  const grad = (a: string, b: string, p: Placed) => {
    if (!b || a === b) return a;
    const g = ctx.createLinearGradient(0, p.top - p.y, 0, p.bottom - p.y);
    g.addColorStop(0, a);
    g.addColorStop(1, b);
    return g;
  };
  const rainbow = o.anims.includes("rainbow") ? `hsl(${Math.round(t * 360)} 92% 58%)` : null;
  const wave = o.anims.includes("wave");

  for (const p of placed) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(p.sx, 1);
    ctx.font = fontOf(o, p.fs);
    ctx.textAlign = "left";
    // A wave bobs and tilts each letter on its own, so it draws them one by one.
    const chars = wave ? Array.from(p.line) : [p.line];
    const start = -ctx.measureText(p.line).width / 2 - p.dx;
    const glyphs = chars.map((ch, i) => ({
      ch,
      x: start + ctx.measureText(chars.slice(0, i).join("")).width,
      w: ctx.measureText(ch).width,
      a: c * 2 * Math.PI - (p.idx + i) * 0.7,
    }));
    const each = (fn: (ch: string, x: number) => void) =>
      glyphs.forEach((g) => {
        ctx.save();
        ctx.translate(g.x + g.w / 2, wave ? Math.sin(g.a) * p.fs * 0.06 : 0);
        if (wave) ctx.rotate(Math.cos(g.a) * 0.08);
        fn(g.ch, -g.w / 2);
        ctx.restore();
      });

    if (o.glow) {
      ctx.shadowColor = rainbow ?? o.fill;
      ctx.shadowBlur = p.fs * 0.25;
    } else if (o.shadow) {
      ctx.shadowColor = "rgba(0,0,0,0.35)";
      ctx.shadowBlur = p.fs * 0.12;
      ctx.shadowOffsetY = p.fs * 0.06;
    }
    // Thickness alone decides whether there is an outline. Presets leave stroke
    // empty, and the colour field already shows black as the standing default,
    // so keying off the colour made the thickness slider a no-op after a preset.
    if (o.strokeW > 0) {
      ctx.lineJoin = "round";
      ctx.lineWidth = (p.fs * o.strokeW) / 100;
      ctx.strokeStyle = grad(o.stroke || "#000000", o.stroke2, p);
      each((ch, x) => ctx.strokeText(ch, x, 0));
      // The outline carries the shadow; the fill on top would double it.
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
    }
    ctx.fillStyle = rainbow ?? grad(o.fill, o.fill2, p);
    each((ch, x) => ctx.fillText(ch, x, 0));
    ctx.restore();
  }
  ctx.restore();

  // Shine: a diagonal highlight swept across the ink only (source-atop), once
  // per cycle, through the first 70% of it so there's a beat between passes.
  if (o.anims.includes("shine")) {
    const u = (c % 1) / 0.7;
    if (u < 1) {
      const band = H * 0.35;
      const cx = -band + u * (W + band * 2);
      const g = ctx.createLinearGradient(cx - band, 0, cx + band, H * 0.5);
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(0.5, "rgba(255,255,255,0.85)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.globalCompositeOperation = "source-atop";
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
  }
  // Background last, underneath, so the shine never lands on it.
  if (!o.transparent) {
    ctx.globalCompositeOperation = "destination-over";
    ctx.fillStyle = o.bg;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.globalCompositeOperation = "source-over";
}

async function toPng(S: number, fn: (ctx: CanvasRenderingContext2D) => void) {
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Your browser blocked the 2D canvas this tool needs.");
  fn(ctx);
  const blob = await new Promise<Blob | null>((res) => c.toBlob(res, "image/png"));
  if (!blob) throw new Error("The browser could not encode the PNG. Try a smaller size.");
  return new Uint8Array(await blob.arrayBuffer());
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
  layout,
  setLayout,
}: ToolBodyProps & {
  text: string;
  setText: (v: string) => void;
  anims: Anim[];
  setAnims: (v: Anim[]) => void;
  layout: Layout;
  setLayout: (v: Layout) => void;
}) {
  const run = useRun({ setBusy, setError, setProgress });
  const format = anims.length || layout === "marquee" ? "gif" : "png";
  const [preset, setPreset] = React.useState("sunset");
  const [style, setStyle] = React.useState<Style>(PRESETS[0].style);
  const [lineMode, setLineMode] = React.useState("auto");
  const [size, setSize] = React.useState(128);
  const [face, setFace] = React.useState<FaceId>("luckiest");
  const [tileCount, setTileCount] = React.useState(0);
  const [speed, setSpeed] = React.useState(4);
  const [tiles, setTiles] = React.useState<{ name: string; url: string }[]>([]);
  React.useEffect(() => () => tiles.forEach((t) => URL.revokeObjectURL(t.url)), [tiles]);

  const lines = lineMode === "auto" ? autoLines(text) : Number(lineMode);
  const opts: Opts = { ...style, text, lines, anims, face };
  const optsRef = React.useRef(opts);
  optsRef.current = opts;

  const go = () =>
    run("Rendering", async () => {
      if (!text.trim()) throw new Error("Type a word or short phrase to render first.");
      const o = optsRef.current;
      const measure = document.createElement("canvas").getContext("2d");
      if (!measure) throw new Error("Your browser blocked the 2D canvas this tool needs.");
      // Ink offsets (Placed.dx) are measured from a centred alignment point.
      measure.textAlign = "center";
      const S = size;

      if (layout === "stack") {
        const placed = stackLayout(measure, S, o);
        if (format === "png") {
          const data = await toPng(S, (ctx) => paint(ctx, S, S, { ...o, anims: [] }, 0, placed));
          publish({
            data,
            ext: "png",
            mime: "image/png",
            note: `${S}px ${preset} ${lines} line(s)`,
          });
        } else {
          const frames = renderFrames({ width: S, height: S }, 16, (ctx, t) =>
            paint(ctx, S, S, o, t, placed),
          );
          setProgress(0.7);
          publish({
            data: encodeGif(frames, {
              delayMs: 70,
              transparent: style.transparent,
              maxColors: 128,
            }),
            ext: "gif",
            note: `${S}px ${preset} ${anims.join("+") || "static"}`,
          });
        }
      } else if (layout === "tiles") {
        // One continuous strip, n squares wide, then cut into squares. Letters
        // straddle the cuts on purpose: :name-1::name-2: in Slack rejoins them.
        const full = rowMetrics(measure, S, o);
        measure.font = fontOf(o, full.fs);
        const fullW = inkMetrics(measure.measureText(o.text)).w;
        // Auto: as many squares as the phrase needs at full height and natural width.
        const n = tileCount || Math.max(1, Math.round((fullW + full.margin * 2) / S));
        const W = n * S;
        // Stretch a little to fill the strip; past that, shrink rather than squash.
        const fit = (W - full.margin * 2) / fullW;
        const row = fit < 0.85 ? rowMetrics(measure, S, o, fit / 0.85) : full;
        measure.font = fontOf(o, row.fs);
        const ink = inkMetrics(measure.measureText(o.text));
        const placed: Placed[] = [
          {
            ...row,
            line: o.text,
            sx: Math.min(1.15, Math.max(0.85, (W - row.margin * 2) / ink.w)),
            dx: ink.dx,
            x: W / 2,
            idx: 0,
          },
        ];
        const strip = document.createElement("canvas");
        strip.width = W;
        strip.height = S;
        const sctx = strip.getContext("2d", { willReadFrequently: true });
        if (!sctx) throw new Error("Your browser blocked the 2D canvas this tool needs.");
        const count = format === "png" ? 1 : 16;
        const frames: ImageData[][] = Array.from({ length: n }, () => []);
        for (let f = 0; f < count; f++) {
          paint(sctx, W, S, format === "png" ? { ...o, anims: [] } : o, f / count, placed);
          frames.forEach((tile, i) => tile.push(sctx.getImageData(i * S, 0, S, S)));
        }
        const stem = slugify(o.text, "text");
        const pad = String(n).length;
        const files: Record<string, Uint8Array> = {};
        const out: { name: string; url: string }[] = [];
        for (const [i, tile] of frames.entries()) {
          const data =
            format === "png"
              ? await toPng(S, (ctx) => ctx.putImageData(tile[0], 0, 0))
              : encodeGif(tile, { delayMs: 70, transparent: style.transparent, maxColors: 128 });
          const name = `${stem}-${String(i + 1).padStart(pad, "0")}.${format}`;
          files[name] = data;
          out.push({
            name,
            url: URL.createObjectURL(
              new Blob([data.slice().buffer as ArrayBuffer], { type: `image/${format}` }),
            ),
          });
          setProgress((i + 1) / n);
        }
        setTiles(out);
        publish({
          data: zipSync(files),
          ext: "zip",
          mime: "application/zip",
          note: `${n} tiles · ${out.map((t) => `:${t.name.replace(/\.\w+$/, "")}:`).join("")}`,
        });
      } else {
        const row = rowMetrics(measure, S, o);
        measure.font = fontOf(o, row.fs);
        const ink = inkMetrics(measure.measureText(o.text));
        // Enter from the right edge, leave past the left, then loop.
        const dist = ink.w + S;
        const n = Math.min(400, Math.max(8, Math.ceil(dist / ((S * speed) / 100))));
        const frames = renderFrames({ width: S, height: S }, n, (ctx, t) =>
          paint(
            ctx,
            S,
            S,
            o,
            t,
            [{ ...row, sx: 1, line: o.text, dx: ink.dx, x: S + ink.w / 2 - t * dist, idx: 0 }],
            // Whole cycles keep the wave and pulse seamless at the loop point.
            Math.max(1, Math.round(n / 16)),
          ),
        );
        setProgress(0.7);
        publish({
          data: encodeGif(frames, { delayMs: 40, transparent: style.transparent, maxColors: 64 }),
          ext: "gif",
          note: `${S}px marquee · ${n} frames`,
        });
      }
      setProgress(1);
    });

  const set = <K extends keyof Style>(k: K, v: Style[K]) => {
    setStyle((s) => ({ ...s, [k]: v }));
    setPreset("custom");
  };

  const fontReady = useFace(face);

  // Dice roll: a preset for the shape, then fresh colours and a random face.
  const randomize = () => {
    const pick = <T,>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)];
    const hue = () => Math.floor(Math.random() * 360);
    const hsl = (h: number, s: number, l: number) => {
      const c = document.createElement("canvas").getContext("2d");
      if (!c) return "#ffffff";
      c.fillStyle = `hsl(${h} ${s}% ${l}%)`;
      return c.fillStyle; // normalised to #rrggbb
    };
    const p = pick(PRESETS);
    const h = hue();
    setPreset("custom");
    setStyle({
      ...p.style,
      fill: hsl(h, 90, 60),
      fill2: Math.random() < 0.5 ? hsl(h, 90, 60) : hsl((h + 40 + hue() / 4) % 360, 90, 55),
      stroke: p.style.stroke ? hsl(h, 60, 12) : "",
      stroke2: "",
      bg: p.style.transparent ? p.style.bg : hsl((h + 180) % 360, 70, 30),
    });
    setFace(pick(FACE_IDS));
  };

  useAutoRun(
    go,
    [text, format, style, lineMode, size, anims, face, layout, tileCount, speed],
    fontReady,
  );
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="te-text">phrase</Label>
          <Input
            id="te-text"
            value={text}
            maxLength={layout === "stack" ? 40 : 80}
            spellCheck={false}
            onChange={(e) => setText(e.target.value)}
            aria-describedby="te-text-hint"
          />
          <p id="te-text-hint" className="text-label text-muted-foreground mt-1">
            {layout === "stack"
              ? "Short is best — each line is stretched to fill the square. Type \\n to force a line break."
              : layout === "tiles"
                ? "One long banner cut into squares — post them side by side to rejoin it."
                : "One line, scrolling right to left through a single square."}
          </p>
        </div>
        <div>
          <Label htmlFor="te-layout">layout</Label>
          <Select
            id="te-layout"
            value={layout}
            onChange={(e) => setLayout(e.target.value as Layout)}
          >
            {(Object.keys(LAYOUTS) as Layout[]).map((k) => (
              <option key={k} value={k}>
                {LAYOUTS[k]}
              </option>
            ))}
          </Select>
        </div>
        {layout === "stack" ? (
          <div>
            <Label htmlFor="te-lines">lines</Label>
            <Select id="te-lines" value={lineMode} onChange={(e) => setLineMode(e.target.value)}>
              <option value="auto">auto ({lines})</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
            </Select>
          </div>
        ) : layout === "tiles" ? (
          <div>
            <Label htmlFor="te-tiles">tiles</Label>
            <Select
              id="te-tiles"
              value={tileCount}
              onChange={(e) => setTileCount(Number(e.target.value))}
            >
              <option value={0}>auto</option>
              {Array.from({ length: 10 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </Select>
          </div>
        ) : (
          <Range
            label="scroll speed"
            min={1}
            max={12}
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
          />
        )}
      </div>

      {layout === "tiles" && tiles.length ? (
        <div>
          <Label>tiles · click one to save it alone</Label>
          <div className="flex w-fit flex-wrap border border-border divide-x divide-border bg-smui-surface-0">
            {tiles.map((t, i) => (
              <a key={t.name} href={t.url} download={t.name} title={t.name}>
                <img
                  src={t.url}
                  alt={`Tile ${i + 1} of ${tiles.length}`}
                  className="block size-16"
                />
              </a>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {(["#ffffff", "#1a1d21"] as const).map((bg) => (
              <span key={bg} className="flex border border-border p-1.5" style={{ background: bg }}>
                {tiles.map((t) => (
                  <img key={t.name} src={t.url} alt="" className="size-[22px]" />
                ))}
              </span>
            ))}
            <span className="text-label text-muted-foreground">in a Slack message</span>
          </div>
        </div>
      ) : null}

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
          <Button type="button" size="sm" variant="outline" onClick={randomize}>
            <Shuffle className="size-3.5" aria-hidden="true" />
            randomize
          </Button>
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
          <Select id="te-font" value={face} onChange={(e) => setFace(e.target.value as FaceId)}>
            {faceOptions("luckiest")}
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
          {layout === "marquee"
            ? "A marquee is always a GIF; these play on top of the scroll."
            : "Tick any to get an animated GIF; none gives a static PNG."}
        </p>
      </div>
    </>
  );
}

export default function TextEmojiTool() {
  // Held here so the download name and its extension can track the controls.
  const [text, setText] = React.useState("hell yeah");
  const [anims, setAnims] = React.useState<Anim[]>([]);
  const [layout, setLayout] = React.useState<Layout>("stack");
  const format = layout === "tiles" ? "zip" : anims.length || layout === "marquee" ? "gif" : "png";
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
        <Body
          {...props}
          text={text}
          setText={setText}
          anims={anims}
          setAnims={setAnims}
          layout={layout}
          setLayout={setLayout}
        />
      )}
    </ToolShell>
  );
}
