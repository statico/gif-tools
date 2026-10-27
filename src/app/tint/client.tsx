"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { ColorField, Range } from "@/components/ui/field";
import { ToolShell, useAutoRun, useRun, type ToolBodyProps } from "@/components/tool-shell";
import { drawPreview, encodeOps, GRAY, type Op, type Pt } from "@/lib/color-ops";
import { useFirstFrame } from "@/lib/preview";
import { getTool } from "@/lib/tools";

const tool = getTool("tint");

type Mode = "hue" | "tint" | "colorize" | "duotone" | "filter";

const MODES: { id: Mode; name: string }[] = [
  { id: "hue", name: "Hue shift" },
  { id: "tint", name: "Tint" },
  { id: "colorize", name: "Colorize" },
  { id: "duotone", name: "Duotone" },
  { id: "filter", name: "Filters" },
];

/** The same curve on all three channels. */
const all = (pts: Pt[]) => ({ r: pts, g: pts, b: pts });
const S_CURVE: Pt[] = [
  [0, 0],
  [48, 28],
  [128, 128],
  [208, 232],
  [255, 255],
];

const FILTERS: { id: string; name: string; ops: Op[] }[] = [
  {
    // Monochrom sensors render reds light and skies dark, like a yellow-orange filter.
    id: "leica-mono",
    name: "Leica Monochrom",
    ops: [
      { kind: "matrix", m: [0.45, 0.45, 0.1, 0.45, 0.45, 0.1, 0.45, 0.45, 0.1] },
      { kind: "curve", ...all(S_CURVE) },
    ],
  },
  {
    id: "leica-classic",
    name: "Leica Classic",
    ops: [
      { kind: "eq", brightness: 0, contrast: 1.1, saturation: 0.8 },
      {
        kind: "curve",
        r: [
          [0, 8],
          [128, 134],
          [255, 255],
        ],
        g: [
          [0, 4],
          [128, 128],
          [255, 248],
        ],
        b: [
          [0, 0],
          [128, 118],
          [255, 235],
        ],
      },
    ],
  },
  {
    id: "leica-vivid",
    name: "Leica Vivid",
    ops: [
      { kind: "eq", brightness: 0, contrast: 1.12, saturation: 1.35 },
      { kind: "curve", ...all(S_CURVE) },
    ],
  },
  {
    id: "noir",
    name: "Noir",
    ops: [
      { kind: "matrix", m: GRAY },
      { kind: "eq", brightness: -0.04, contrast: 1.6, saturation: 1 },
    ],
  },
  {
    id: "sepia",
    name: "Sepia",
    ops: [{ kind: "matrix", m: [0.393, 0.769, 0.189, 0.349, 0.686, 0.168, 0.272, 0.534, 0.131] }],
  },
  {
    id: "teal-orange",
    name: "Teal & Orange",
    ops: [
      {
        kind: "curve",
        r: [
          [0, 0],
          [128, 142],
          [255, 255],
        ],
        g: [
          [0, 8],
          [255, 245],
        ],
        b: [
          [0, 36],
          [128, 116],
          [255, 210],
        ],
      },
      { kind: "eq", brightness: 0, contrast: 1.08, saturation: 1.15 },
    ],
  },
  {
    id: "cross-process",
    name: "Cross Process",
    ops: [
      {
        kind: "curve",
        r: [
          [0, 0],
          [64, 40],
          [192, 225],
          [255, 255],
        ],
        g: [
          [0, 0],
          [64, 56],
          [192, 210],
          [255, 255],
        ],
        b: [
          [0, 50],
          [255, 195],
        ],
      },
    ],
  },
  {
    id: "faded",
    name: "Faded Film",
    ops: [
      { kind: "eq", brightness: 0, contrast: 1, saturation: 0.75 },
      {
        kind: "curve",
        r: [
          [0, 38],
          [255, 240],
        ],
        g: [
          [0, 34],
          [255, 236],
        ],
        b: [
          [0, 46],
          [255, 226],
        ],
      },
    ],
  },
  {
    id: "polaroid",
    name: "Polaroid",
    ops: [
      { kind: "eq", brightness: 0.02, contrast: 0.95, saturation: 0.9 },
      {
        kind: "curve",
        r: [
          [0, 22],
          [255, 252],
        ],
        g: [
          [0, 16],
          [255, 244],
        ],
        b: [
          [0, 40],
          [255, 218],
        ],
      },
    ],
  },
  {
    id: "cyanotype",
    name: "Cyanotype",
    ops: [
      { kind: "matrix", m: GRAY },
      {
        kind: "curve",
        r: [
          [0, 10],
          [255, 225],
        ],
        g: [
          [0, 40],
          [255, 238],
        ],
        b: [
          [0, 90],
          [255, 252],
        ],
      },
    ],
  },
  {
    id: "night-vision",
    name: "Night Vision",
    ops: [
      { kind: "matrix", m: GRAY },
      { kind: "eq", brightness: 0.05, contrast: 1.3, saturation: 1 },
      {
        kind: "curve",
        r: [
          [0, 0],
          [255, 150],
        ],
        g: [
          [0, 10],
          [255, 255],
        ],
        b: [
          [0, 0],
          [255, 110],
        ],
      },
    ],
  },
];

const DEFAULTS = {
  mode: "hue" as Mode,
  hue: 90,
  saturation: 1,
  color: "#d08770",
  strength: 0.5,
  shadow: "#2e3440",
  highlight: "#ebcb8b",
  filter: "leica-mono",
};

type Settings = typeof DEFAULTS;

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** Settings → operations. The only place, so preview and encode agree. */
function tintOps(s: Settings): Op[] {
  switch (s.mode) {
    case "hue": {
      const ops: Op[] = [{ kind: "hue", degrees: s.hue }];
      if (s.saturation !== 1)
        ops.push({ kind: "eq", brightness: 0, contrast: 1, saturation: s.saturation });
      return ops;
    }
    case "tint": {
      // A coloured gel: each channel multiplied toward the colour by `strength`.
      const [r, g, b] = rgb(s.color).map((c) => 1 - s.strength + (s.strength * c) / 255);
      return [{ kind: "matrix", m: [r, 0, 0, 0, g, 0, 0, 0, b] }];
    }
    case "colorize": {
      // Black → colour → white through the luminance, like Photoshop's Colorize.
      const [r, g, b] = rgb(s.color).map((c): Pt[] => [
        [0, 0],
        [128, c],
        [255, 255],
      ]);
      return [{ kind: "matrix", m: GRAY }, { kind: "curve", r, g, b }];
    }
    case "duotone": {
      const lo = rgb(s.shadow);
      const hi = rgb(s.highlight);
      const [r, g, b] = [0, 1, 2].map((i): Pt[] => [
        [0, lo[i]],
        [255, hi[i]],
      ]);
      return [{ kind: "matrix", m: GRAY }, { kind: "curve", r, g, b }];
    }
    case "filter":
      return FILTERS.find((f) => f.id === s.filter)?.ops ?? [];
  }
}

function ButtonGroup<T extends string>({
  id,
  label,
  items,
  value,
  onPick,
}: {
  id: string;
  label: string;
  items: { id: T; name: string }[];
  value: T;
  onPick: (v: T) => void;
}) {
  return (
    <div role="group" aria-labelledby={id}>
      <span
        id={id}
        className="text-label text-muted-foreground tracking-[1.5px] uppercase block mb-1"
      >
        {label}
      </span>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {items.map((it) => (
          <Button
            key={it.id}
            type="button"
            variant={it.id === value ? "default" : "outline"}
            size="sm"
            aria-pressed={it.id === value}
            onClick={() => onPick(it.id)}
          >
            {it.name}
          </Button>
        ))}
      </div>
    </div>
  );
}

function Body({ file, setBusy, setProgress, setError, publish }: ToolBodyProps) {
  const run = useRun({ setBusy, setError, setProgress });
  const [s, setS] = React.useState(DEFAULTS);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) =>
    setS((prev) => ({ ...prev, [k]: v }));

  const { frame, size } = useFirstFrame(file);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  // Cap the preview so a 4K source still repaints instantly on every drag.
  const scale = size ? Math.min(280 / size.w, 280 / size.h, 1) : 1;
  const pw = size ? Math.max(1, Math.round(size.w * scale)) : 0;
  const ph = size ? Math.max(1, Math.round(size.h * scale)) : 0;

  React.useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d", { willReadFrequently: true });
    if (!ctx || !frame || !pw || !ph) return;
    drawPreview(ctx, frame, pw, ph, tintOps(s), scale);
  }, [frame, pw, ph, s, scale]);

  const go = () =>
    run("Tinting", async () => {
      if (!file) throw new Error("Choose a GIF, image or video first.");
      const { data, ext, filters } = await encodeOps(file, tintOps(s), setProgress);
      publish({ data, ext, note: filters });
    });

  useAutoRun(go, [file, s], !!file);

  const modeName = MODES.find((m) => m.id === s.mode)!.name;
  const look = s.mode === "filter" ? FILTERS.find((f) => f.id === s.filter)!.name : modeName;

  return (
    <>
      <ButtonGroup
        id="tint-mode-label"
        label="mode"
        items={MODES}
        value={s.mode}
        onPick={(v) => set("mode", v)}
      />

      {s.mode === "hue" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Range
            id="tint-hue"
            label="hue shift"
            min={-180}
            max={180}
            step={1}
            value={s.hue}
            suffix="°"
            onChange={(e) => set("hue", Number(e.target.value))}
          />
          <Range
            id="tint-saturation"
            label="saturation"
            min={0}
            max={3}
            step={0.05}
            value={s.saturation}
            onChange={(e) => set("saturation", Number(e.target.value))}
          />
        </div>
      ) : null}

      {s.mode === "tint" || s.mode === "colorize" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <ColorField
            id="tint-color"
            label="colour"
            value={s.color}
            onChange={(v) => set("color", v)}
          />
          {s.mode === "tint" ? (
            <Range
              id="tint-strength"
              label="strength"
              min={0}
              max={1}
              step={0.05}
              value={s.strength}
              onChange={(e) => set("strength", Number(e.target.value))}
            />
          ) : null}
        </div>
      ) : null}

      {s.mode === "duotone" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <ColorField
            id="tint-shadow"
            label="shadows"
            value={s.shadow}
            onChange={(v) => set("shadow", v)}
          />
          <ColorField
            id="tint-highlight"
            label="highlights"
            value={s.highlight}
            onChange={(v) => set("highlight", v)}
          />
        </div>
      ) : null}

      {s.mode === "filter" ? (
        <ButtonGroup
          id="tint-filter-label"
          label="filter"
          items={FILTERS}
          value={s.filter}
          onPick={(v) => set("filter", v)}
        />
      ) : null}

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
              className="checkerboard border-border block max-w-full border"
              role="img"
              aria-label={`First frame with ${look} applied`}
            />
          </div>
          <p className="text-label text-muted-foreground mt-1" aria-live="polite">
            {look} — first frame only, updated as you change settings.
          </p>
        </div>
      ) : null}
    </>
  );
}

export default function TintTool() {
  return (
    <ToolShell
      tool={tool}
      accept="image/gif,image/png,image/jpeg,image/webp,video/*"
      defaultName="tint"
      hint="Hue shift, colour gel, colorize, duotone or a film-style filter. Animation and transparency are kept; still images come back as PNG."
    >
      {(props) => <Body {...props} />}
    </ToolShell>
  );
}
