"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Label, Range, Readout, Select } from "@/components/ui/field";
import { ToolShell, useRun, type ToolBodyProps } from "@/components/tool-shell";
import { compressImage, MagickFormat } from "@/lib/engines/magick";
import { useFirstFrame } from "@/lib/preview";
import { getTool } from "@/lib/tools";
import { formatBytes } from "@/lib/utils";

const tool = getTool("compress");

const FORMATS = {
  jpeg: { format: MagickFormat.Jpeg, ext: "jpg", label: "JPEG" },
  png: { format: MagickFormat.Png, ext: "png", label: "PNG" },
  webp: { format: MagickFormat.WebP, ext: "webp", label: "WebP" },
} as const;
type FormatKey = keyof typeof FORMATS;

function Body({ file, setBusy, setProgress, setError, publish }: ToolBodyProps) {
  const run = useRun({ setBusy, setError, setProgress });
  const [key, setKey] = React.useState<FormatKey>("jpeg");
  const [quality, setQuality] = React.useState(82);
  const [strip, setStrip] = React.useState(true);
  const [saving, setSaving] = React.useState<{ text: string; pct: number } | null>(null);
  // Shared with the preview tools: one browser decode, and it reports failure
  // instead of leaving the readout on "reading…" forever.
  const { size: dims, failed } = useFirstFrame(file);

  React.useEffect(() => setSaving(null), [file]);

  // ImageMagick re-encodes in place; nothing here resizes.
  const lossless = key === "png";
  const qualityWords =
    quality >= 90
      ? "near-lossless, largest file"
      : quality >= 75
        ? "sharp detail"
        : quality >= 50
          ? "visible softening"
          : "small file, blocky";

  const go = () =>
    run("Compressing", async () => {
      setSaving(null); // a failed run must not leave the last file's result on screen
      if (!file) throw new Error("Choose a PNG, JPEG or WebP first.");
      const target = FORMATS[key];
      setProgress(0.3);
      const out = await compressImage(file, { format: target.format, quality, strip });
      setProgress(1);
      const pct = Math.round((1 - out.length / file.size) * 100);
      setSaving({
        text: `${formatBytes(file.size)} → ${formatBytes(out.length)} (${
          pct >= 0 ? `${pct}% smaller` : `${-pct}% larger`
        })`,
        pct,
      });
      publish({
        data: out,
        ext: target.ext,
        note: `${target.label} q=${quality}${strip ? " stripped" : ""}`,
      });
    });

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="cmp-format">output format</Label>
          <Select id="cmp-format" value={key} onChange={(e) => setKey(e.target.value as FormatKey)}>
            <option value="jpeg">JPEG — smallest, no transparency</option>
            <option value="png">PNG — lossless, keeps transparency</option>
            <option value="webp">WebP — small, keeps transparency</option>
          </Select>
        </div>
        <Range
          label="quality"
          min={1}
          max={100}
          step={1}
          value={quality}
          onChange={(e) => setQuality(Number(e.target.value))}
        />
      </div>

      <Checkbox
        label="Strip metadata (EXIF, colour profile, comments)"
        checked={strip}
        onChange={(e) => setStrip(e.target.checked)}
      />

      <Readout
        rows={
          [
            ["size", dims ? `${dims.w} × ${dims.h} px` : !file ? "—" : failed ? "unknown" : "reading…"],
            ["format", `.${FORMATS[key].ext}`],
            ["quality", lossless ? "lossless — quality not used" : `${quality} — ${qualityWords}`],
            ["metadata", strip ? "stripped" : "kept"],
          ] as const
        }
      />

      <p
        role="status"
        aria-live="polite"
        className={`text-ui min-h-5 ${
          !saving || saving.pct >= 0
            ? "text-[hsl(var(--smui-green))]"
            : "text-[hsl(var(--smui-yellow))]"
        }`}
      >
        {saving?.text ?? ""}
      </p>

      <Button onClick={go} disabled={!file}>
        Compress image
      </Button>
    </>
  );
}

export default function CompressTool() {
  return (
    <ToolShell
      tool={tool}
      accept="image/png,image/jpeg,image/webp"
      defaultName="compressed"
      hint="Re-encodes a still image with ImageMagick. Quality only affects JPEG and WebP; PNG stays lossless."
    >
      {(props) => <Body {...props} />}
    </ToolShell>
  );
}
