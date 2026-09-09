"use client";
import * as React from "react";
import { Input, Label } from "@/components/ui/field";
import { ToolShell, useAutoRun, useRun, type ToolBodyProps } from "@/components/tool-shell";
import { ffmpegOnce, paletteGifArgs, probe } from "@/lib/engines/ffmpeg";
import { getTool } from "@/lib/tools";
import { clamp } from "@/lib/utils";

const tool = getTool("cut");

function outExt(name: string): string {
  const e = name.split(".").pop()?.toLowerCase() ?? "";
  if (["gif", "webp", "mp4", "webm"].includes(e)) return e;
  if (["mov", "avi", "mkv", "m4v"].includes(e)) return "mp4";
  return "gif";
}

const round2 = (v: number) => Math.round(v * 100) / 100;

function Body({ file, setBusy, setProgress, setError, publish }: ToolBodyProps) {
  const run = useRun({ setBusy, setError, setProgress });
  const [duration, setDuration] = React.useState<number | null>(null);
  const [start, setStart] = React.useState(0);
  const [end, setEnd] = React.useState(0);

  React.useEffect(() => {
    // Drop the old file's timing first: a failed probe must not leave the
    // sliders and the Cut button live on the previous file's duration.
    setDuration(null);
    if (!file) return;
    let stale = false;
    // The probe shares the ffmpeg queue with a real encode, so it must not
    // drive the shell's busy state: its finally would clear the badge of a
    // conversion the user started while it was still pending.
    probe(file)
      .then((info) => {
        if (stale) return;
        if (!info.durationSec) {
          setError(
            "Could not read a duration from that file. Cut needs an animated GIF or a video.",
          );
          return;
        }
        setDuration(info.durationSec);
        setStart(0);
        setEnd(round2(info.durationSec));
      })
      .catch((e: unknown) => {
        if (!stale) setError(e instanceof Error ? e.message : "Could not read that file.");
      });
    return () => {
      stale = true;
    };
  }, [file, setError]);

  const max = duration ?? 0;
  // Never let the two controls meet: the selection is always at least minLen,
  // so "end before start" and a zero-length cut cannot be typed or dragged in.
  const minLen = Math.min(0.1, max);
  const onStart = (v: number) => {
    const s = clamp(round2(v), 0, round2(max - minLen));
    setStart(s);
    if (end < s + minLen) setEnd(round2(s + minLen));
  };
  const onEnd = (v: number) => {
    const e = clamp(round2(v), round2(minLen), max);
    setEnd(e);
    if (start > e - minLen) setStart(round2(e - minLen));
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

  useAutoRun(go, [file, start, end], !!file && !!duration);
  return (
    <>
      <div className="grid gap-4">
        <div>
          <Label htmlFor="cut-start-range">start (seconds)</Label>
          <input
            id="cut-start-range"
            type="range"
            min={0}
            max={round2(max - minLen) || 1}
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
            max={round2(max - minLen) || undefined}
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
            min={round2(minLen)}
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
            min={round2(minLen)}
            max={max || undefined}
            step={0.01}
            value={end}
            disabled={!duration}
            onChange={(e) => onEnd(Number(e.target.value))}
          />
        </div>
      </div>

      <div
        role="status"
        aria-live="polite"
        className="border border-border bg-smui-surface-0 p-3 grid gap-1"
      >
        <span className="text-label uppercase tracking-wider text-muted-foreground">result</span>
        <p className="text-ui text-foreground tabular-nums">
          {duration
            ? `${round2(duration)}s \u2192 ${selected}s`
            : "Choose an animated GIF or video to read its duration."}
        </p>
        {duration ? (
          <p className="text-label text-muted-foreground tabular-nums">
            {`Keeping ${start}s to ${end}s of the source.`}
          </p>
        ) : null}
      </div>
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
