"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/field";
import { ToolShell, useRun, type ToolBodyProps } from "@/components/tool-shell";
import { ffmpegOnce, paletteGifArgs } from "@/lib/engines/ffmpeg";
import { getTool } from "@/lib/tools";

const tool = getTool("reverse");

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

      <Button onClick={go} disabled={!file}>
        {mode === "boomerang" ? "Make boomerang" : "Reverse"}
      </Button>
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
