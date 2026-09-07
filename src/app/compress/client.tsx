"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Label, Range, Select } from "@/components/ui/field";
import { ToolShell, useRun, type ToolBodyProps } from "@/components/tool-shell";
import { compressImage, MagickFormat } from "@/lib/engines/magick";
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
  const [saving, setSaving] = React.useState<string | null>(null);

  const go = () =>
    run("Compressing", async () => {
      if (!file) throw new Error("Choose a PNG, JPEG or WebP first.");
      const target = FORMATS[key];
      setProgress(0.3);
      const out = await compressImage(file, { format: target.format, quality, strip });
      setProgress(1);
      const pct = Math.round((1 - out.length / file.size) * 100);
      setSaving(
        `${formatBytes(file.size)} → ${formatBytes(out.length)} (${
          pct >= 0 ? `${pct}% smaller` : `${-pct}% larger`
        })`,
      );
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
          <Select
            id="cmp-format"
            value={key}
            onChange={(e) => setKey(e.target.value as FormatKey)}
          >
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

      <p role="status" aria-live="polite" className="text-ui text-[hsl(var(--smui-green))] min-h-5">
        {saving ?? ""}
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
