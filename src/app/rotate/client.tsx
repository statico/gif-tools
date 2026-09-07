"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Label, Select } from "@/components/ui/field";
import { ToolShell, useRun, type ToolBodyProps } from "@/components/tool-shell";
import { ffmpegOnce, paletteGifArgs } from "@/lib/engines/ffmpeg";
import { getTool } from "@/lib/tools";

const tool = getTool("rotate");

function outputExt(file: File): "gif" | "webm" | "mp4" | "png" {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "gif" || file.type === "image/gif") return "gif";
  if (ext === "webm" || file.type === "video/webm") return "webm";
  if (file.type.startsWith("video/")) return "mp4";
  return "png";
}

const HEX = /^#[0-9a-fA-F]{6}$/;

const TURNS: Record<string, string> = {
  "0": "",
  "90": "transpose=1",
  "180": "transpose=1,transpose=1",
  "270": "transpose=2",
};

function Body({ file, setBusy, setProgress, setError, publish }: ToolBodyProps) {
  const run = useRun({ setBusy, setError, setProgress });
  const [turn, setTurn] = React.useState<keyof typeof TURNS | "custom">("90");
  const [angle, setAngle] = React.useState(15);
  const [bg, setBg] = React.useState("#000000");
  const [hflip, setHflip] = React.useState(false);
  const [vflip, setVflip] = React.useState(false);

  const go = () =>
    run("Rotating", async () => {
      if (!file) throw new Error("Choose a GIF, image or video first.");
      if (turn === "custom" && !HEX.test(bg)) {
        throw new Error("Background colour must be a six-digit hex value like #1a1a1a.");
      }

      const parts: string[] = [];
      if (turn === "custom") {
        if (!Number.isFinite(angle)) throw new Error("Enter a rotation angle in degrees.");
        const rad = `${angle}*PI/180`;
        parts.push(`rotate=${rad}:fillcolor=0x${bg.slice(1)}:ow=rotw(${rad}):oh=roth(${rad})`);
      } else if (TURNS[turn]) {
        parts.push(TURNS[turn]);
      }
      if (hflip) parts.push("hflip");
      if (vflip) parts.push("vflip");
      if (parts.length === 0) throw new Error("Pick a rotation or a flip — nothing to do yet.");

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
            : ext === "png"
              ? ["-i", input, "-vf", filters, "-frames:v", "1", output]
              : ["-i", input, "-filter:v", filters, "-an", "-pix_fmt", "yuv420p", output],
        { onProgress: (r) => setProgress(r) },
      ).catch((err: unknown) => {
        throw new Error(
          `ffmpeg could not rotate this file (${err instanceof Error ? err.message : String(err)}). Check the angle and try a different input format.`,
        );
      });

      publish({ data: out, ext, note: filters });
    });

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="rotate-turn">rotation</Label>
          <Select
            id="rotate-turn"
            value={turn}
            onChange={(e) => setTurn(e.target.value as typeof turn)}
          >
            <option value="0">None</option>
            <option value="90">90° clockwise</option>
            <option value="180">180°</option>
            <option value="270">270° clockwise</option>
            <option value="custom">Custom angle</option>
          </Select>
        </div>

        {turn === "custom" ? (
          <div>
            <Label htmlFor="rotate-angle">angle in degrees</Label>
            <Input
              id="rotate-angle"
              type="number"
              min={-360}
              max={360}
              step={1}
              value={angle}
              onChange={(e) => setAngle(Number(e.target.value))}
            />
          </div>
        ) : null}
      </div>

      {turn === "custom" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="rotate-bg">corner background colour</Label>
            <input
              id="rotate-bg"
              type="color"
              value={HEX.test(bg) ? bg : "#000000"}
              onChange={(e) => setBg(e.target.value)}
              className="h-9 w-full border border-input bg-background p-1"
            />
          </div>
          <div>
            <Label htmlFor="rotate-bg-hex">background colour hex</Label>
            <Input
              id="rotate-bg-hex"
              value={bg}
              spellCheck={false}
              onChange={(e) => setBg(e.target.value)}
              aria-invalid={!HEX.test(bg)}
              aria-describedby="rotate-bg-hex-hint"
            />
            <p id="rotate-bg-hex-hint" className="text-label text-muted-foreground mt-1">
              Six-digit hex, for example #1a1a1a.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3">
        <Checkbox
          label="Flip horizontally (mirror)"
          checked={hflip}
          onChange={(e) => setHflip(e.target.checked)}
        />
        <Checkbox
          label="Flip vertically"
          checked={vflip}
          onChange={(e) => setVflip(e.target.checked)}
        />
      </div>

      <Button onClick={go} disabled={!file}>
        Rotate
      </Button>
    </>
  );
}

export default function RotateTool() {
  return (
    <ToolShell
      tool={tool}
      accept="image/gif,image/png,image/jpeg,image/webp,video/*"
      defaultName="rotated"
      hint="Rotation is applied first, then the flips. Animation is kept; still images come back as PNG."
    >
      {(props) => <Body {...props} />}
    </ToolShell>
  );
}
