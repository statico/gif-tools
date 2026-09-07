"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { ToolShell, useRun, type ToolBodyProps } from "@/components/tool-shell";
import { ffmpegOnce, paletteGifArgs, probe } from "@/lib/engines/ffmpeg";
import { getTool } from "@/lib/tools";

const tool = getTool("cut");

function outExt(name: string): string {
  const e = name.split(".").pop()?.toLowerCase() ?? "";
  if (["gif", "webp", "mp4", "webm"].includes(e)) return e;
  if (["mov", "avi", "mkv", "m4v"].includes(e)) return "mp4";
  return "gif";
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
const round2 = (v: number) => Math.round(v * 100) / 100;

function Body({ file, setBusy, setProgress, setError, publish }: ToolBodyProps) {
  const run = useRun({ setBusy, setError, setProgress });
  const [duration, setDuration] = React.useState<number | null>(null);
  const [start, setStart] = React.useState(0);
  const [end, setEnd] = React.useState(0);

  React.useEffect(() => {
    if (!file) {
      setDuration(null);
      return;
    }
    let stale = false;
    setBusy(true, "Reading duration");
    probe(file)
      .then((info) => {
        if (stale) return;
        if (!info.durationSec) {
          setError("Could not read a duration from that file. Cut needs an animated GIF or a video.");
          return;
        }
        setDuration(info.durationSec);
        setStart(0);
        setEnd(round2(info.durationSec));
      })
      .catch((e: unknown) => {
        if (!stale) setError(e instanceof Error ? e.message : "Could not read that file.");
      })
      .finally(() => {
        if (!stale) setBusy(false);
      });
    return () => {
      stale = true;
    };
  }, [file, setBusy, setError]);

  const max = duration ?? 0;
  const onStart = (v: number) => {
    const s = clamp(round2(v), 0, max);
    setStart(s);
    if (s >= end) setEnd(round2(Math.min(max, s + 0.1)));
  };
  const onEnd = (v: number) => {
    const e = clamp(round2(v), 0, max);
    setEnd(e);
    if (e <= start) setStart(round2(Math.max(0, e - 0.1)));
  };

  const selected = round2(Math.max(0, end - start));

  const go = () =>
    run("Cutting", async () => {
      if (!file) throw new Error("Choose a file first.");
      if (!duration) throw new Error("Still reading the duration — try again in a moment.");
      if (selected <= 0) throw new Error("The end time must be after the start time.");
      const ext = outExt(file.name);
      const out = await ffmpegOnce(
        file,
        `in.${ext}`,
        `out.${ext}`,
        ({ input, output }) => {
          if (ext === "gif") {
            // paletteGifArgs starts at "-i" and ends with the output name, so
            // seek goes on the front and the duration limit just before it.
            const args = paletteGifArgs({ input, output, filters: "null" });
            args.unshift("-ss", String(start));
            args.splice(args.length - 1, 0, "-t", String(selected));
            return args;
          }
          return ["-ss", String(start), "-i", input, "-t", String(selected), output];
        },
        { onProgress: (r) => setProgress(r), durationSec: selected },
      );
      publish({ data: out, ext, note: `${start}s → ${end}s` });
    });

  return (
    <>
      <div className="grid gap-4">
        <div>
          <Label htmlFor="cut-start-range">start (seconds)</Label>
          <input
            id="cut-start-range"
            type="range"
            min={0}
            max={max || 1}
            step={0.01}
            value={start}
            disabled={!duration}
            onChange={(e) => onStart(Number(e.target.value))}
            className="w-full accent-primary h-9"
          />
          <Label htmlFor="cut-start-num">start time in seconds</Label>
          <Input
            id="cut-start-num"
            type="number"
            min={0}
            max={max || undefined}
            step={0.01}
            value={start}
            disabled={!duration}
            onChange={(e) => onStart(Number(e.target.value))}
          />
        </div>

        <div>
          <Label htmlFor="cut-end-range">end (seconds)</Label>
          <input
            id="cut-end-range"
            type="range"
            min={0}
            max={max || 1}
            step={0.01}
            value={end}
            disabled={!duration}
            onChange={(e) => onEnd(Number(e.target.value))}
            className="w-full accent-primary h-9"
          />
          <Label htmlFor="cut-end-num">end time in seconds</Label>
          <Input
            id="cut-end-num"
            type="number"
            min={0}
            max={max || undefined}
            step={0.01}
            value={end}
            disabled={!duration}
            onChange={(e) => onEnd(Number(e.target.value))}
          />
        </div>
      </div>

      <p className="text-ui text-muted-foreground" role="status" aria-live="polite">
        {duration
          ? `Source ${round2(duration)}s → keeping ${selected}s (${start}s to ${end}s)`
          : "Choose an animated GIF or video to read its duration."}
      </p>

      <Button onClick={go} disabled={!file || !duration}>
        Cut
      </Button>
    </>
  );
}

export default function CutTool() {
  return (
    <ToolShell
      tool={tool}
      accept="image/gif,image/webp,video/*"
      defaultName="cut"
      hint="Trim to a start and end point. The output keeps the format you put in."
    >
      {(props) => <Body {...props} />}
    </ToolShell>
  );
}
