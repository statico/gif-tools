"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Label, Range, Readout, Select } from "@/components/ui/field";
import { ToolShell, useRun, type ToolBodyProps } from "@/components/tool-shell";
import { ffmpegOnce, paletteGifArgs } from "@/lib/engines/ffmpeg";
import { useFirstFrame } from "@/lib/preview";
import { getTool } from "@/lib/tools";

const tool = getTool("convert");

type Target = "gif" | "png" | "jpg" | "webp" | "apng" | "bmp";

const TARGETS: { value: Target; label: string; animated: boolean; quality: boolean }[] = [
  { value: "gif", label: "GIF — animated", animated: true, quality: false },
  { value: "webp", label: "WebP — animated or still", animated: true, quality: true },
  { value: "apng", label: "APNG — animated PNG", animated: true, quality: false },
  { value: "png", label: "PNG — still, lossless", animated: false, quality: false },
  { value: "jpg", label: "JPEG — still, lossy", animated: false, quality: true },
  { value: "bmp", label: "BMP — still, uncompressed", animated: false, quality: false },
];

const ANIMATED_SOURCES = /\.(gif|webp|apng|png|mp4|webm|mov|avi|mkv)$/i;

function Body({ file, setBusy, setProgress, setError, publish }: ToolBodyProps) {
  const run = useRun({ setBusy, setError, setProgress });
  const [target, setTarget] = React.useState<Target>("webp");
  const [quality, setQuality] = React.useState(80);
  const [colors, setColors] = React.useState(256);
  const [animate, setAnimate] = React.useState(true);

  // Dimensions come from the browser decode useFirstFrame already does; probe()
  // would boot the 32MB ffmpeg core just to read two numbers.
  const { size: source } = useFirstFrame(file);

  const spec = TARGETS.find((t) => t.value === target)!;
  // Only offer to keep animation when both sides could actually have it.
  const canAnimate = spec.animated && !!file && ANIMATED_SOURCES.test(file.name);
  const keepAnimation = canAnimate && animate;
  // No scale filter anywhere in this tool, so the pixels come out as they went in.
  const size = source ? `${source.w} × ${source.h} px` : file ? "reading…" : "—";
  const qualityWords =
    quality >= 90
      ? "near-lossless, largest file"
      : quality >= 70
        ? "sharp detail"
        : quality >= 45
          ? "visible softening"
          : "small file, blocky";
  const readout: [string, string][] = [
    ["size", size],
    ["format", `.${target}`],
    [
      "animation",
      keepAnimation ? "kept if the source has more than one frame" : "first frame only",
    ],
  ];
  if (spec.quality) readout.push(["quality", `${quality} — ${qualityWords}`]);
  // The single-frame GIF path has no palettegen stage, so `colors` does nothing there.
  else if (target === "gif")
    readout.push(["colors", keepAnimation ? `up to ${colors}` : "not used for one frame"]);

  const go = () =>
    run(`Converting to ${target.toUpperCase()}`, async () => {
      if (!file) throw new Error("Choose an image first.");
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const still = keepAnimation ? [] : ["-frames:v", "1"];
      // JPEG's q:v runs 2 (best) to 31 (worst) — invert the friendly slider.
      const jpegQ = Math.round(31 - (quality / 100) * 29);

      const out = await ffmpegOnce(
        file,
        `in.${ext}`,
        `out.${target}`,
        ({ input, output }) => {
          switch (target) {
            case "gif":
              return keepAnimation
                ? paletteGifArgs({ input, output, filters: "null", colors })
                : ["-i", input, "-frames:v", "1", "-f", "gif", output];
            case "webp":
              return keepAnimation
                ? [
                    "-i",
                    input,
                    "-c:v",
                    "libwebp_anim",
                    "-loop",
                    "0",
                    "-quality",
                    String(quality),
                    output,
                  ]
                : ["-i", input, ...still, "-c:v", "libwebp", "-quality", String(quality), output];
            case "apng":
              return keepAnimation
                ? ["-i", input, "-f", "apng", "-plays", "0", output]
                : ["-i", input, ...still, "-f", "apng", output];
            case "jpg":
              return ["-i", input, ...still, "-q:v", String(jpegQ), output];
            case "png":
            case "bmp":
              return ["-i", input, ...still, output];
          }
        },
        { onProgress: setProgress },
      );

      publish({
        data: out,
        ext: target,
        note: `${ext} → ${target}${keepAnimation ? " (animated)" : ""}`,
      });
    });

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="cv-target">output format</Label>
          <Select
            id="cv-target"
            value={target}
            onChange={(e) => setTarget(e.target.value as Target)}
          >
            {TARGETS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </div>
        {spec.quality ? (
          <Range
            label="quality"
            min={1}
            max={100}
            step={1}
            value={quality}
            onChange={(e) => setQuality(Number(e.target.value))}
          />
        ) : target === "gif" ? (
          <Range
            label="max colors"
            min={2}
            max={256}
            step={2}
            value={colors}
            onChange={(e) => setColors(Number(e.target.value))}
          />
        ) : null}
      </div>

      {canAnimate ? (
        <Checkbox
          label="Keep animation (uncheck for just the first frame)"
          checked={animate}
          onChange={(e) => setAnimate(e.target.checked)}
        />
      ) : (
        <p role="status" aria-live="polite" className="text-label text-muted-foreground">
          {spec.animated
            ? "This output can animate, but the source is a still image."
            : `${target.toUpperCase()} is a still format — only the first frame is kept.`}
        </p>
      )}

      <Readout rows={readout} />

      <Button onClick={go} disabled={!file}>
        Convert to {target.toUpperCase()}
      </Button>
    </>
  );
}

export default function ConvertTool() {
  return (
    <ToolShell
      tool={tool}
      accept="image/gif,image/png,image/jpeg,image/webp,image/bmp,image/apng,video/*"
      defaultName="converted"
      hint="Animation survives whenever both the source and the target support it."
    >
      {(props) => <Body {...props} />}
    </ToolShell>
  );
}
