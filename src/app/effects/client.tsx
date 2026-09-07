"use client";
import * as React from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label, Range, Select } from "@/components/ui/field";
import { ToolShell, useRun, type ToolBodyProps } from "@/components/tool-shell";
import { ffmpegOnce, paletteGifArgs } from "@/lib/engines/ffmpeg";
import { getTool } from "@/lib/tools";

const tool = getTool("effects");

function outputExt(file: File): "gif" | "webm" | "mp4" | "png" {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "gif" || file.type === "image/gif") return "gif";
  if (ext === "webm" || file.type === "video/webm") return "webm";
  if (file.type.startsWith("video/")) return "mp4";
  return "png";
}

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

function Body({ file, setBusy, setProgress, setError, publish }: ToolBodyProps) {
  const run = useRun({ setBusy, setError, setProgress });
  const [s, setS] = React.useState(DEFAULTS);
  const set = <K extends keyof typeof DEFAULTS>(k: K, v: (typeof DEFAULTS)[K]) =>
    setS((prev) => ({ ...prev, [k]: v }));

  const go = () =>
    run("Applying effects", async () => {
      if (!file) throw new Error("Choose a GIF, image or video first.");

      const parts: string[] = [];
      switch (s.effect) {
        case "grayscale":
          parts.push("colorchannelmixer=.3:.59:.11:0:.3:.59:.11:0:.3:.59:.11");
          break;
        case "sepia":
          parts.push(
            "colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131",
          );
          break;
        case "invert":
          parts.push("negate");
          break;
        case "blur":
          parts.push(`boxblur=${s.amount}:1`);
          break;
        case "sharpen":
          parts.push(`unsharp=5:5:${s.amount.toFixed(2)}`);
          break;
        case "posterize": {
          // Quantise each channel to `levels` steps.
          const step = (255 / Math.max(s.levels - 1, 1)).toFixed(3);
          const e = `trunc(val/${step})*${step}`;
          parts.push(`lutrgb=r=${e}:g=${e}:b=${e}`);
          break;
        }
        default:
          break;
      }

      if (s.brightness !== 0 || s.contrast !== 1 || s.saturation !== 1) {
        parts.push(
          `eq=brightness=${s.brightness}:contrast=${s.contrast}:saturation=${s.saturation}`,
        );
      }
      if (s.hue !== 0) parts.push(`hue=h=${s.hue}`);

      if (parts.length === 0) {
        throw new Error("Pick an effect or move an adjustment slider — nothing to apply yet.");
      }

      const filters = parts.join(",");
      const ext = outputExt(file);
      const srcExt = file.name.split(".").pop()?.toLowerCase() || "bin";

      const out = await ffmpegOnce(
        file,
        `in.${srcExt}`,
        `out.${ext}`,
        ({ input, output }) =>
          ext === "gif"
            ? paletteGifArgs({ input, output, filters })
            : ext === "png"
              ? ["-i", input, "-vf", filters, "-frames:v", "1", output]
              : ["-i", input, "-filter:v", filters, "-an", "-pix_fmt", "yuv420p", output],
        { onProgress: (r) => setProgress(r) },
      ).catch((err: unknown) => {
        throw new Error(
          `ffmpeg could not apply these filters (${err instanceof Error ? err.message : String(err)}). Try a milder setting or a different input format.`,
        );
      });

      publish({ data: out, ext, note: filters });
    });

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

      <div className="flex flex-wrap gap-2">
        <Button onClick={go} disabled={!file}>
          Apply effects
        </Button>
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
