"use client";
import * as React from "react";
import { Checkbox, Input, Label, Range, Select } from "@/components/ui/field";
import { ToolShell, useAutoRun, useRun, type ToolBodyProps } from "@/components/tool-shell";
import { ffmpegOnce, paletteGifArgs, probe } from "@/lib/engines/ffmpeg";
import { getTool } from "@/lib/tools";

const tool = getTool("speed");

const secs = (v: number) => `${v.toFixed(2)}s`;

// GIF frame delays are whole hundredths of a second and browsers clamp anything
// under 2cs to 10cs, so a GIF that asks for more than 50fps plays back *slower*.
const GIF_MAX_FPS = 50;
// Fallback for a source whose rate ffmpeg does not print (some single-frame
// GIFs); typical hand-made GIF territory.
const REF_FPS = 15;
const round1 = (v: number) => Math.round(v * 10) / 10;

/** GIF stays a GIF, WebM stays WebM, any other video becomes MP4. */
function outputExt(file: File): "gif" | "webm" | "mp4" {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "gif" || file.type === "image/gif") return "gif";
  if (ext === "webm" || file.type === "video/webm") return "webm";
  return "mp4";
}

function Body({ file, setBusy, setProgress, setError, publish }: ToolBodyProps) {
  const run = useRun({ setBusy, setError, setProgress });
  const [mode, setMode] = React.useState<"multiplier" | "fps">("multiplier");
  const [multiplier, setMultiplier] = React.useState(2);
  const [fps, setFps] = React.useState(15);
  const [drop, setDrop] = React.useState(false);
  const [dropFps, setDropFps] = React.useState(12);
  const [duration, setDuration] = React.useState<number | null>(null);
  const [srcFps, setSrcFps] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!file) {
      setDuration(null);
      setSrcFps(null);
      return;
    }
    let stale = false;
    // The probe shares the ffmpeg queue with a real encode, so it must not
    // drive the shell's busy state: its finally would clear the badge of a
    // conversion the user started while it was still pending.
    probe(file)
      .then((info) => {
        if (stale) return;
        setDuration(info.durationSec);
        setSrcFps(info.fps);
      })
      .catch(() => {
        if (!stale) setDuration(null);
      });
    return () => {
      stale = true;
    };
  }, [file]);

  // The fps filter only resamples, so the capped length still matches the headline.
  const capFps =
    !!file &&
    outputExt(file) === "gif" &&
    mode === "multiplier" &&
    !drop &&
    multiplier * (srcFps ?? REF_FPS) > GIF_MAX_FPS;

  const go = () =>
    run("Changing speed", async () => {
      if (!file) throw new Error("Choose a GIF or video first.");
      if (mode === "multiplier" && !(multiplier >= 0.1 && multiplier <= 10)) {
        throw new Error("Speed multiplier must be between 0.1x and 10x.");
      }
      if (mode === "fps" && !(fps >= 1 && fps <= 60)) {
        throw new Error("Target frame rate must be between 1 and 60 fps.");
      }

      // Multiplier retimes existing frames; fps mode stamps a fixed interval
      // onto every frame (N is the frame index, TB the output timebase).
      const parts = mode === "multiplier" ? [`setpts=PTS/${multiplier}`] : [`setpts=N/${fps}/TB`];
      if (mode === "multiplier" && drop) parts.push(`fps=${dropFps}`);
      if (capFps) parts.push(`fps=${GIF_MAX_FPS}`);
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
            : ["-i", input, "-filter:v", filters, "-an", "-pix_fmt", "yuv420p", output],
        { onProgress: (r) => setProgress(r) },
      ).catch((err: unknown) => {
        throw new Error(
          `ffmpeg could not re-time this file (${err instanceof Error ? err.message : String(err)}). Try a shorter clip or a different input format.`,
        );
      });

      publish({
        data: out,
        ext,
        note:
          mode === "multiplier" ? `${multiplier}x${drop ? ` @ ${dropFps}fps` : ""}` : `${fps} fps`,
      });
    });

  // Live readout, derived from the same numbers the filters are built from:
  // setpts=PTS/m divides the length by m; the fps filter only resamples, so it
  // changes the frame rate and not the length. setpts=N/fps/TB restamps every
  // frame at a fixed interval, so the new length is frame count ÷ fps.
  const badMultiplier = mode === "multiplier" && !(multiplier >= 0.1 && multiplier <= 10);
  const badFps = mode === "fps" && !(fps >= 1 && fps <= 60);
  let headline: string;
  let detail: string;
  if (badMultiplier || badFps) {
    headline = "Out of range";
    detail = badMultiplier
      ? "Speed multiplier must be between 0.1x and 10x."
      : "Target frame rate must be between 1 and 60 fps.";
  } else if (mode === "multiplier") {
    headline = duration
      ? `${secs(duration)} → ${secs(duration / multiplier)}`
      : `Length ÷ ${multiplier}`;
    detail = drop
      ? `Frame rate forced to ${dropFps} fps (frames are dropped, the length above does not change).`
      : capFps
        ? `Frame rate capped at ${GIF_MAX_FPS} fps — a GIF cannot hold a frame for less than 2/100s, so anything faster would play slower instead.`
        : `Frame rate ×${multiplier} — a 15 fps source plays at ${round1(15 * multiplier)} fps.`;
  } else {
    headline = `Every frame held ${(1 / fps).toFixed(3)}s`;
    detail = `New length is frame count ÷ ${fps} fps${
      duration ? `, so it stays ${secs(duration)} only if the source is already ${fps} fps` : ""
    }.`;
  }

  useAutoRun(go, [file, mode, multiplier, fps, drop, dropFps], !!file);
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="speed-mode">mode</Label>
          <Select
            id="speed-mode"
            value={mode}
            onChange={(e) => setMode(e.target.value as "multiplier" | "fps")}
          >
            <option value="multiplier">Speed multiplier</option>
            <option value="fps">Target frame rate</option>
          </Select>
        </div>

        {mode === "multiplier" ? (
          <div>
            <Label htmlFor="speed-multiplier">speed multiplier (0.1x – 10x)</Label>
            <Input
              id="speed-multiplier"
              type="number"
              min={0.1}
              max={10}
              step={0.1}
              value={multiplier}
              onChange={(e) => setMultiplier(Number(e.target.value))}
              aria-describedby="speed-multiplier-hint"
            />
            <p id="speed-multiplier-hint" className="text-label text-muted-foreground mt-1">
              Above 1 is faster, below 1 is slower.
            </p>
          </div>
        ) : (
          <div>
            <Label htmlFor="speed-fps">target frame rate</Label>
            <Input
              id="speed-fps"
              type="number"
              min={1}
              max={60}
              step={1}
              value={fps}
              onChange={(e) => setFps(Number(e.target.value))}
              aria-describedby="speed-fps-hint"
            />
            <p id="speed-fps-hint" className="text-label text-muted-foreground mt-1">
              Every frame is shown for 1/{fps || 1} of a second.
            </p>
          </div>
        )}
      </div>

      {mode === "multiplier" ? (
        <div className="grid gap-3">
          <Checkbox
            label="Drop frames to keep the file small"
            checked={drop}
            onChange={(e) => setDrop(e.target.checked)}
          />
          {drop ? (
            <Range
              id="speed-drop-fps"
              aria-label="frames per second after dropping"
              label="frames per second after dropping"
              min={2}
              max={30}
              step={1}
              value={dropFps}
              suffix=" fps"
              onChange={(e) => setDropFps(Number(e.target.value))}
            />
          ) : null}
        </div>
      ) : null}

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

export default function SpeedTool() {
  return (
    <ToolShell
      tool={tool}
      accept="image/gif,video/*"
      defaultName="speed"
      hint="Speeding up or slowing down keeps the original format — a GIF stays a GIF, a video stays a video. Audio is dropped."
    >
      {(props) => <Body {...props} />}
    </ToolShell>
  );
}
