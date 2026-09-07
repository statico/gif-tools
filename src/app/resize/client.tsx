"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Label, Select } from "@/components/ui/field";
import { ToolShell, useRun, type ToolBodyProps } from "@/components/tool-shell";
import { ffmpegOnce, paletteGifArgs, probe } from "@/lib/engines/ffmpeg";
import { getTool } from "@/lib/tools";
import { outExt } from "@/lib/format";

const tool = getTool("resize");

const VIDEO = ["mp4", "webm"];

function Body({ file, setBusy, setProgress, setError, publish }: ToolBodyProps) {
  const run = useRun({ setBusy, setError, setProgress });
  const [src, setSrc] = React.useState<{ w: number; h: number } | null>(null);
  const [mode, setMode] = React.useState<"pixels" | "percent">("pixels");
  const [width, setWidth] = React.useState(480);
  const [height, setHeight] = React.useState(270);
  const [percent, setPercent] = React.useState(50);
  const [lock, setLock] = React.useState(true);
  const [filter, setFilter] = React.useState("lanczos");

  React.useEffect(() => {
    if (!file) {
      setSrc(null);
      return;
    }
    let stale = false;
    setBusy(true, "Reading dimensions");
    probe(file)
      .then((info) => {
        if (stale) return;
        if (!info.width || !info.height) {
          setError("Could not read the dimensions of that file. Try a GIF, image or video.");
          return;
        }
        setSrc({ w: info.width, h: info.height });
        setWidth(info.width);
        setHeight(info.height);
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

  const onWidth = (v: number) => {
    setWidth(v);
    if (lock && src && v > 0) setHeight(Math.max(1, Math.round((v * src.h) / src.w)));
  };
  const onHeight = (v: number) => {
    setHeight(v);
    if (lock && src && v > 0) setWidth(Math.max(1, Math.round((v * src.w) / src.h)));
  };

  const target =
    mode === "percent" && src
      ? { w: Math.round((src.w * percent) / 100), h: Math.round((src.h * percent) / 100) }
      : { w: width, h: height };

  const go = () =>
    run("Resizing", async () => {
      if (!file) throw new Error("Choose a file first.");
      if (!src) throw new Error("Still reading the source dimensions — try again in a moment.");
      const ext = outExt(file.name);
      const isVideo = VIDEO.includes(ext);
      // Video encoders need even dimensions; GIF and stills don't care.
      const w = isVideo ? Math.max(2, target.w - (target.w % 2)) : Math.max(1, target.w);
      const h = isVideo ? Math.max(2, target.h - (target.h % 2)) : Math.max(1, target.h);
      if (!Number.isFinite(w) || !Number.isFinite(h) || w < 1 || h < 1) {
        throw new Error("Width and height must both be at least 1 pixel.");
      }
      const scale = `scale=${w}:${h}:flags=${filter}`;
      const onProgress = (r: number) => setProgress(r);
      const out = await ffmpegOnce(
        file,
        `in.${ext}`,
        `out.${ext}`,
        ({ input, output }) =>
          ext === "gif"
            ? paletteGifArgs({ input, output, filters: scale })
            : ["-i", input, "-vf", scale, output],
        { onProgress },
      );
      publish({ data: out, ext, note: `${w}x${h} ${filter}` });
    });

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="resize-mode">mode</Label>
          <Select
            id="resize-mode"
            value={mode}
            onChange={(e) => setMode(e.target.value as "pixels" | "percent")}
          >
            <option value="pixels">by pixels</option>
            <option value="percent">by percent</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="resize-filter">scaling filter</Label>
          <Select id="resize-filter" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="lanczos">lanczos — sharpest (default)</option>
            <option value="bicubic">bicubic — smoother</option>
            <option value="neighbor">nearest neighbor — pixel art</option>
          </Select>
        </div>
      </div>

      {mode === "pixels" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="resize-w">width (px)</Label>
            <Input
              id="resize-w"
              type="number"
              min={1}
              max={4000}
              value={width}
              onChange={(e) => onWidth(Number(e.target.value))}
            />
          </div>
          <div>
            <Label htmlFor="resize-h">height (px)</Label>
            <Input
              id="resize-h"
              type="number"
              min={1}
              max={4000}
              value={height}
              onChange={(e) => onHeight(Number(e.target.value))}
            />
          </div>
        </div>
      ) : (
        <div>
          <Label htmlFor="resize-pct">percent of original</Label>
          <Input
            id="resize-pct"
            type="number"
            min={1}
            max={400}
            value={percent}
            onChange={(e) => setPercent(Number(e.target.value))}
          />
        </div>
      )}

      <Checkbox
        label="Lock aspect ratio"
        checked={lock}
        onChange={(e) => setLock(e.target.checked)}
      />

      <p className="text-ui text-muted-foreground" role="status" aria-live="polite">
        {src
          ? `Source ${src.w}×${src.h} → output ${Math.max(1, target.w)}×${Math.max(1, target.h)}`
          : "Choose a file to read its dimensions."}
      </p>

      <Button onClick={go} disabled={!file || !src}>
        Resize
      </Button>
    </>
  );
}

export default function ResizeTool() {
  return (
    <ToolShell
      tool={tool}
      defaultName="resized"
      hint="Scale a GIF, image or video. GIFs are re-encoded with a generated palette so the smaller version still looks clean."
    >
      {(props) => <Body {...props} />}
    </ToolShell>
  );
}
