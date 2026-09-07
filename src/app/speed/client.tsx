"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Label, Range, Select } from "@/components/ui/field";
import { ToolShell, useRun, type ToolBodyProps } from "@/components/tool-shell";
import { ffmpegOnce, paletteGifArgs } from "@/lib/engines/ffmpeg";
import { getTool } from "@/lib/tools";

const tool = getTool("speed");

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
      const parts =
        mode === "multiplier" ? [`setpts=PTS/${multiplier}`] : [`setpts=N/${fps}/TB`];
      if (mode === "multiplier" && drop) parts.push(`fps=${dropFps}`);
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
          mode === "multiplier"
            ? `${multiplier}x${drop ? ` @ ${dropFps}fps` : ""}`
            : `${fps} fps`,
      });
    });

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

      <Button onClick={go} disabled={!file}>
        Change speed
      </Button>
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
