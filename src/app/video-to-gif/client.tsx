"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Label, Range } from "@/components/ui/field";
import { ToolShell, useRun, type ToolBodyProps } from "@/components/tool-shell";
import { ffmpegOnce, paletteGifArgs, probe } from "@/lib/engines/ffmpeg";
import { getTool } from "@/lib/tools";

const tool = getTool("video-to-gif");

function Body({ file, setBusy, setProgress, setError, publish }: ToolBodyProps) {
  const run = useRun({ setBusy, setError, setProgress });
  const [start, setStart] = React.useState(0);
  const [end, setEnd] = React.useState(5);
  const [fps, setFps] = React.useState(15);
  const [width, setWidth] = React.useState(480);
  const [colors, setColors] = React.useState(256);
  const [dither, setDither] = React.useState(true);
  const [source, setSource] = React.useState<{ durationSec: number | null; width: number | null } | null>(null);

  // Read the real duration so the range can be prefilled and clamped.
  React.useEffect(() => {
    if (!file) {
      setSource(null);
      return;
    }
    let cancelled = false;
    setSource(null);
    probe(file)
      .then((info) => {
        if (cancelled) return;
        setSource(info);
        setStart(0);
        setEnd(info.durationSec ? Math.min(info.durationSec, 5) : 5);
        if (info.width) setWidth(Math.min(info.width, 480));
      })
      .catch(() => {
        if (!cancelled) setError("Could not read the video. It may be an unsupported format.");
      });
    return () => {
      cancelled = true;
    };
  }, [file, setError]);

  const max = source?.durationSec ?? null;
  const duration = Math.max(0, end - start);

  const go = () =>
    run("Encoding GIF", async () => {
      if (!file) throw new Error("Choose a video first.");
      if (duration <= 0) throw new Error("End time must be after the start time.");
      const ext = file.name.split(".").pop()?.toLowerCase() || "mp4";
      const out = await ffmpegOnce(
        file,
        `in.${ext}`,
        "out.gif",
        ({ input, output }) => [
          "-ss",
          String(start),
          "-t",
          String(duration),
          ...paletteGifArgs({
            input,
            output,
            filters: `fps=${fps},scale=${width}:-1:flags=lanczos`,
            colors,
            dither: dither ? "bayer:bayer_scale=5" : "none",
          }),
        ],
        { onProgress: setProgress, durationSec: duration },
      );
      publish({
        data: out,
        ext: "gif",
        note: `${start}s +${duration}s @ ${fps}fps ${width}px ${colors} colors`,
      });
    });

  return (
    <>
      <p role="status" aria-live="polite" className="text-ui text-muted-foreground">
        {file
          ? source
            ? `Source: ${source.width ?? "?"}px wide, ${max ? `${max.toFixed(2)}s` : "unknown"} long.`
            : "Reading the video…"
          : "No video chosen yet."}
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="v2g-start">start time (seconds)</Label>
          <Input
            id="v2g-start"
            type="number"
            min={0}
            max={max ?? undefined}
            step={0.1}
            value={start}
            onChange={(e) => setStart(Math.max(0, Number(e.target.value) || 0))}
          />
        </div>
        <div>
          <Label htmlFor="v2g-end">end time (seconds)</Label>
          <Input
            id="v2g-end"
            type="number"
            min={0}
            max={max ?? undefined}
            step={0.1}
            value={end}
            onChange={(e) => setEnd(Math.max(0, Number(e.target.value) || 0))}
            aria-describedby="v2g-end-hint"
          />
          <p id="v2g-end-hint" className="text-label text-muted-foreground mt-1">
            {duration > 0 ? `${duration.toFixed(2)}s of GIF` : "End must be after start"}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Range
          label="frame rate"
          suffix=" fps"
          min={5}
          max={30}
          step={1}
          value={fps}
          onChange={(e) => setFps(Number(e.target.value))}
        />
        <div>
          <Label htmlFor="v2g-width">output width (px)</Label>
          <Input
            id="v2g-width"
            type="number"
            min={16}
            max={2000}
            step={2}
            value={width}
            onChange={(e) => setWidth(Math.max(16, Number(e.target.value) || 16))}
            aria-describedby="v2g-width-hint"
          />
          <p id="v2g-width-hint" className="text-label text-muted-foreground mt-1">
            Height follows the aspect ratio.
          </p>
        </div>
      </div>

      <Range
        label="max colors"
        min={2}
        max={256}
        step={2}
        value={colors}
        onChange={(e) => setColors(Number(e.target.value))}
      />

      <Checkbox
        label="Dither (smoother gradients, larger file)"
        checked={dither}
        onChange={(e) => setDither(e.target.checked)}
      />

      <Button onClick={go} disabled={!file}>
        Convert to GIF
      </Button>
    </>
  );
}

export default function VideoToGifTool() {
  return (
    <ToolShell
      tool={tool}
      accept="video/*"
      defaultName="video"
      hint="Pick a range, a frame rate and a width. A two-pass palette encode keeps colours clean."
    >
      {(props) => <Body {...props} />}
    </ToolShell>
  );
}
