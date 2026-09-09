"use client";
import * as React from "react";
import { Label, Select } from "@/components/ui/field";
import { ToolShell, useAutoRun, useRun, type ToolBodyProps } from "@/components/tool-shell";
import { ffmpegOnce, paletteGifArgs, probe } from "@/lib/engines/ffmpeg";
import { getTool } from "@/lib/tools";

const tool = getTool("reverse");

const secs = (v: number) => `${v.toFixed(2)}s`;

function outputExt(file: File): "gif" | "webm" | "mp4" {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "gif" || file.type === "image/gif") return "gif";
  if (ext === "webm" || file.type === "video/webm") return "webm";
  return "mp4";
}

/**
 * Boomerang: split the stream, reverse one copy, concatenate. `trim` throws
 * away the duplicated last frame so the turnaround does not stutter.
 */
const BOOMERANG =
  "split[fa][fb];[fb]reverse,trim=start_frame=1,setpts=PTS-STARTPTS[fr];[fa][fr]concat=n=2:v=1";

function Body({ file, setBusy, setProgress, setError, publish }: ToolBodyProps) {
  const run = useRun({ setBusy, setError, setProgress });
  const [mode, setMode] = React.useState<"reverse" | "boomerang">("reverse");
  const [duration, setDuration] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!file) {
      setDuration(null);
      return;
    }
    let stale = false;
    // The probe shares the ffmpeg queue with a real encode, so it must not
    // drive the shell's busy state: its finally would clear the badge of a
    // conversion the user started while it was still pending.
    probe(file)
      .then((info) => {
        if (!stale) setDuration(info.durationSec);
      })
      .catch(() => {
        if (!stale) setDuration(null);
      });
    return () => {
      stale = true;
    };
  }, [file]);

  const go = () =>
    run(mode === "boomerang" ? "Building boomerang" : "Reversing", async () => {
      if (!file) throw new Error("Choose a GIF or video first.");

      const ext = outputExt(file);
      const srcExt = file.name.split(".").pop()?.toLowerCase() || "bin";
      const filters = mode === "boomerang" ? BOOMERANG : "reverse";

      const out = await ffmpegOnce(
        file,
        `in.${srcExt}`,
        `out.${ext}`,
        ({ input, output }) =>
          ext === "gif"
            ? paletteGifArgs({ input, output, filters })
            : [
                "-i",
                input,
                "-filter_complex",
                `[0:v]${filters}[v]`,
                "-map",
                "[v]",
                "-an",
                "-pix_fmt",
                "yuv420p",
                output,
              ],
        { onProgress: (r) => setProgress(r) },
      ).catch((err: unknown) => {
        throw new Error(
          `ffmpeg could not reverse this file (${err instanceof Error ? err.message : String(err)}). Reversing buffers every frame in memory — trim the clip down and try again.`,
        );
      });

      publish({ data: out, ext, note: mode });
    });

  // Reverse keeps every frame, so the length is unchanged. Boomerang appends
  // the reversed copy minus its first frame (trim=start_frame=1), so it plays
  // 2n-1 frames: twice the length, one frame short.
  const headline = duration
    ? mode === "boomerang"
      ? `${secs(duration)} \u2192 ${secs(duration * 2)} (one frame less)`
      : `${secs(duration)} \u2192 ${secs(duration)}`
    : mode === "boomerang"
      ? "Roughly twice the source length"
      : "Same length as the source";
  const detail =
    mode === "boomerang"
      ? "Forward, then backwards: about twice the frames, minus the duplicated turnaround frame."
      : "Every frame is kept, played back to front: same frame count, same length.";

  useAutoRun(go, [file, mode], !!file);
  return (
    <>
      <div>
        <Label htmlFor="reverse-mode">direction</Label>
        <Select
          id="reverse-mode"
          value={mode}
          onChange={(e) => setMode(e.target.value as "reverse" | "boomerang")}
        >
          <option value="reverse">Reverse — play backwards</option>
          <option value="boomerang">Boomerang — forward, then back</option>
        </Select>
      </div>

      <p className="text-ui text-muted-foreground">
        Reversing has to load every frame into memory at once, so very long or very large inputs can
        run out of memory and fail. Cut the clip down first if that happens.
      </p>

      <div
        role="status"
        aria-live="polite"
        className="border border-border bg-smui-surface-0 p-3 grid gap-1"
      >
        <span className="text-label uppercase tracking-wider text-muted-foreground">result</span>
        <p className="text-ui text-foreground tabular-nums">{headline}</p>
        <p className="text-label text-muted-foreground tabular-nums">{detail}</p>
      </div>
    </>
  );
}

export default function ReverseTool() {
  return (
    <ToolShell
      tool={tool}
      accept="image/gif,video/*"
      defaultName="reversed"
      hint="A GIF stays a GIF and a video stays a video. Audio is dropped."
    >
      {(props) => <Body {...props} />}
    </ToolShell>
  );
}
