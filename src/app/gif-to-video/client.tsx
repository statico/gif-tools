"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Label, Range, Select } from "@/components/ui/field";
import { ToolShell, useRun, type ToolBodyProps } from "@/components/tool-shell";
import { ffmpegOnce } from "@/lib/engines/ffmpeg";
import { getTool } from "@/lib/tools";
import { formatBytes } from "@/lib/utils";

const tool = getTool("gif-to-video");

// h264 and vp9 both need even dimensions; GIFs regularly have odd ones.
const EVEN = "scale=trunc(iw/2)*2:trunc(ih/2)*2";

function Body({ file, setBusy, setProgress, setError, publish }: ToolBodyProps) {
  const run = useRun({ setBusy, setError, setProgress });
  const [format, setFormat] = React.useState<"mp4" | "webm">("mp4");
  const [crf, setCrf] = React.useState(28);
  const [saving, setSaving] = React.useState<string | null>(null);

  const go = () =>
    run(`Encoding ${format.toUpperCase()}`, async () => {
      if (!file) throw new Error("Choose a GIF first.");
      const out = await ffmpegOnce(
        file,
        "in.gif",
        `out.${format}`,
        ({ input, output }) =>
          format === "mp4"
            ? [
                "-i", input,
                "-vf", EVEN,
                "-c:v", "libx264",
                "-crf", String(crf),
                "-pix_fmt", "yuv420p",
                "-movflags", "+faststart",
                output,
              ]
            : [
                "-i", input,
                "-vf", EVEN,
                "-c:v", "libvpx-vp9",
                "-crf", String(crf),
                "-b:v", "0",
                "-pix_fmt", "yuv420p",
                output,
              ],
        { onProgress: setProgress },
      );
      const pct = Math.round((1 - out.length / file.size) * 100);
      setSaving(
        `${formatBytes(file.size)} → ${formatBytes(out.length)} (${pct >= 0 ? `${pct}% smaller` : `${-pct}% larger`})`,
      );
      publish({ data: out, ext: format, note: `${format} crf=${crf}` });
    });

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="g2v-format">output format</Label>
          <Select
            id="g2v-format"
            value={format}
            onChange={(e) => setFormat(e.target.value as "mp4" | "webm")}
          >
            <option value="mp4">MP4 (h264) — plays everywhere</option>
            <option value="webm">WebM (vp9) — smaller, modern browsers</option>
          </Select>
        </div>
        <Range
          label="quality (crf)"
          min={format === "mp4" ? 15 : 20}
          max={format === "mp4" ? 40 : 50}
          step={1}
          value={crf}
          onChange={(e) => setCrf(Number(e.target.value))}
        />
      </div>

      <p className="text-label text-muted-foreground">
        Lower CRF means better quality and a bigger file.
      </p>

      {saving ? (
        <p role="status" aria-live="polite" className="text-ui text-[hsl(var(--smui-green))]">
          {saving}
        </p>
      ) : null}

      <Button onClick={go} disabled={!file}>
        Convert to {format.toUpperCase()}
      </Button>
    </>
  );
}

export default function GifToVideoTool() {
  return (
    <ToolShell
      tool={tool}
      accept="image/gif,video/*"
      defaultName="video"
      hint="Video codecs beat GIF compression badly — expect a fraction of the original size."
    >
      {(props) => <Body {...props} />}
    </ToolShell>
  );
}
