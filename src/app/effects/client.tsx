"use client";
import * as React from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label, Range, Select } from "@/components/ui/field";
import { ToolShell, useAutoRun, useRun, type ToolBodyProps } from "@/components/tool-shell";
import { drawPreview, encodeOps, GRAY, type Op } from "@/lib/color-ops";
import { useFirstFrame } from "@/lib/preview";
import { getTool } from "@/lib/tools";

const tool = getTool("effects");

type Effect = "none" | "grayscale" | "sepia" | "invert" | "blur" | "sharpen" | "posterize";

const DEFAULTS = {
  effect: "none" as Effect,
  amount: 3,
  levels: 4,
  brightness: 0,
  contrast: 1,
  saturation: 1,
  hue: 0,
};

type Settings = typeof DEFAULTS;

/**
 * THE effect maths. The only place settings turn into operations, so the
 * preview and the encode can never disagree about what is being applied.
 */
function effectOps(s: Settings): Op[] {
  const ops: Op[] = [];
  switch (s.effect) {
    case "grayscale":
      ops.push({ kind: "matrix", m: GRAY });
      break;
    case "sepia":
      ops.push({
        kind: "matrix",
        m: [0.393, 0.769, 0.189, 0.349, 0.686, 0.168, 0.272, 0.534, 0.131],
      });
      break;
    case "invert":
      ops.push({ kind: "negate" });
      break;
    case "blur":
      ops.push({ kind: "blur", radius: s.amount });
      break;
    case "sharpen":
      ops.push({ kind: "sharpen", amount: s.amount });
      break;
    case "posterize":
      // Quantise each channel to `levels` steps.
      ops.push({ kind: "posterize", step: 255 / Math.max(s.levels - 1, 1) });
      break;
    default:
      break;
  }
  if (s.brightness !== 0 || s.contrast !== 1 || s.saturation !== 1) {
    ops.push({
      kind: "eq",
      brightness: s.brightness,
      contrast: s.contrast,
      saturation: s.saturation,
    });
  }
  if (s.hue !== 0) ops.push({ kind: "hue", degrees: s.hue });
  return ops;
}

function Body({ file, setBusy, setProgress, setError, publish }: ToolBodyProps) {
  const run = useRun({ setBusy, setError, setProgress });
  const [s, setS] = React.useState(DEFAULTS);
  const set = <K extends keyof typeof DEFAULTS>(k: K, v: (typeof DEFAULTS)[K]) =>
    setS((prev) => ({ ...prev, [k]: v }));

  const ops = effectOps(s);
  const { frame, size } = useFirstFrame(file);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  // Cap the preview so a 4K source still repaints instantly on every drag.
  const scale = size ? Math.min(280 / size.w, 280 / size.h, 1) : 1;
  const pw = size ? Math.max(1, Math.round(size.w * scale)) : 0;
  const ph = size ? Math.max(1, Math.round(size.h * scale)) : 0;

  React.useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d", { willReadFrequently: true });
    if (!ctx || !frame || !pw || !ph) return;
    drawPreview(ctx, frame, pw, ph, effectOps(s), scale);
  }, [frame, pw, ph, s, scale]);

  const go = () =>
    run("Applying effects", async () => {
      if (!file) throw new Error("Choose a GIF, image or video first.");

      if (ops.length === 0) {
        throw new Error("Pick an effect or move an adjustment slider — nothing to apply yet.");
      }

      const { data, ext, filters } = await encodeOps(file, ops, setProgress);
      publish({ data, ext, note: filters });
    });

  useAutoRun(go, [file, s], !!file);
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="fx-effect">effect</Label>
          <Select
            id="fx-effect"
            value={s.effect}
            onChange={(e) => set("effect", e.target.value as Effect)}
          >
            <option value="none">None</option>
            <option value="grayscale">Grayscale</option>
            <option value="sepia">Sepia</option>
            <option value="invert">Invert</option>
            <option value="blur">Blur</option>
            <option value="sharpen">Sharpen</option>
            <option value="posterize">Posterize</option>
          </Select>
        </div>

        {s.effect === "blur" || s.effect === "sharpen" ? (
          <Range
            id="fx-amount"
            aria-label={s.effect === "blur" ? "blur radius" : "sharpen amount"}
            label={s.effect === "blur" ? "blur radius" : "sharpen amount"}
            min={s.effect === "blur" ? 1 : 0.5}
            max={s.effect === "blur" ? 20 : 5}
            step={s.effect === "blur" ? 1 : 0.5}
            value={s.amount}
            onChange={(e) => set("amount", Number(e.target.value))}
          />
        ) : null}

        {s.effect === "posterize" ? (
          <Range
            id="fx-levels"
            aria-label="posterize levels"
            label="posterize levels"
            min={2}
            max={16}
            step={1}
            value={s.levels}
            onChange={(e) => set("levels", Number(e.target.value))}
          />
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Range
          id="fx-brightness"
          aria-label="brightness"
          label="brightness"
          min={-1}
          max={1}
          step={0.05}
          value={s.brightness}
          onChange={(e) => set("brightness", Number(e.target.value))}
        />
        <Range
          id="fx-contrast"
          aria-label="contrast"
          label="contrast"
          min={0}
          max={3}
          step={0.05}
          value={s.contrast}
          onChange={(e) => set("contrast", Number(e.target.value))}
        />
        <Range
          id="fx-saturation"
          aria-label="saturation"
          label="saturation"
          min={0}
          max={3}
          step={0.05}
          value={s.saturation}
          onChange={(e) => set("saturation", Number(e.target.value))}
        />
        <Range
          id="fx-hue"
          aria-label="hue shift in degrees"
          label="hue shift"
          min={-180}
          max={180}
          step={1}
          value={s.hue}
          suffix="°"
          onChange={(e) => set("hue", Number(e.target.value))}
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
              className="checkerboard border-border block max-w-full border"
              role="img"
              aria-label={`First frame with the ${s.effect === "none" ? "current adjustments" : s.effect + " effect"} applied`}
            />
          </div>
          <p className="text-label text-muted-foreground mt-1">
            First frame only, updated as you drag. Apply effects to render the whole file.
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setS(DEFAULTS)}>
          <RotateCcw aria-hidden="true" />
          Reset to defaults
        </Button>
      </div>
    </>
  );
}

export default function EffectsTool() {
  return (
    <ToolShell
      tool={tool}
      accept="image/gif,image/png,image/jpeg,image/webp,video/*"
      defaultName="effects"
      hint="One effect at a time, stacked with the brightness, contrast, saturation and hue sliders. Animation is kept; still images come back as PNG."
    >
      {(props) => <Body {...props} />}
    </ToolShell>
  );
}
