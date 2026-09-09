"use client";
import * as React from "react";
import { Input, Label, Select } from "@/components/ui/field";
import { ToolShell, useAutoRun, useRun, type ToolBodyProps } from "@/components/tool-shell";
import { ffmpegOnce, paletteGifArgs } from "@/lib/engines/ffmpeg";
import { getTool } from "@/lib/tools";
import { outExt } from "@/lib/format";
import { NO_PREVIEW, useFirstFrame } from "@/lib/preview";
import { clamp } from "@/lib/utils";

const tool = getTool("crop");

/** Side of the square live-preview canvas, in device-independent pixels. */
const PREVIEW = 240;

const RATIOS: Record<string, number | null> = {
  free: null,
  "1:1": 1,
  "4:3": 4 / 3,
  "16:9": 16 / 9,
};

function Body({ file, setBusy, setProgress, setError, publish }: ToolBodyProps) {
  const run = useRun({ setBusy, setError, setProgress });
  const [sel, setSel] = React.useState({ x: 0, y: 0, w: 0, h: 0 });
  const [ratioKey, setRatioKey] = React.useState("free");
  const boxRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const dragStart = React.useRef<{ x: number; y: number } | null>(null);
  const ratio = RATIOS[ratioKey] ?? null;
  const { frame, size: src, failed } = useFirstFrame(file);

  const url = React.useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  React.useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );

  // The decoded frame is the one source of truth for dimensions, so `sel` and the
  // preview share a coordinate space. probe() would boot the 32MB ffmpeg core to
  // read two numbers the decode already gave us.
  React.useEffect(() => {
    if (src) setSel({ x: 0, y: 0, w: src.w, h: src.h });
  }, [src]);

  /** Clamp a candidate rect to the source and honour the aspect preset. */
  const commit = React.useCallback(
    (r: { x: number; y: number; w: number; h: number }) => {
      if (!src) return;
      let w = clamp(Math.round(r.w), 1, src.w);
      let x = clamp(Math.round(r.x), 0, src.w - w);
      let h = clamp(Math.round(r.h), 1, src.h);
      let y = clamp(Math.round(r.y), 0, src.h - h);
      if (ratio) {
        h = clamp(Math.round(w / ratio), 1, src.h);
        w = clamp(Math.round(h * ratio), 1, src.w);
        x = clamp(x, 0, src.w - w);
        y = clamp(y, 0, src.h - h);
      }
      setSel({ x, y, w, h });
    },
    [src, ratio],
  );

  // Re-apply the ratio when the preset changes.
  React.useEffect(() => {
    if (ratio) commit(sel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ratioKey]);

  // Live preview of the exact rect ffmpeg will crop: same `sel`, no reprojection
  // from screen coordinates. One drawImage per pointermove keeps the drag smooth.
  React.useEffect(() => {
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx || !frame || !src || sel.w < 1 || sel.h < 1) return;
    const fit = Math.min(PREVIEW / sel.w, PREVIEW / sel.h);
    const dw = Math.max(1, Math.round(sel.w * fit));
    const dh = Math.max(1, Math.round(sel.h * fit));
    ctx.clearRect(0, 0, PREVIEW, PREVIEW);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(
      frame,
      sel.x,
      sel.y,
      sel.w,
      sel.h,
      Math.round((PREVIEW - dw) / 2),
      Math.round((PREVIEW - dh) / 2),
      dw,
      dh,
    );
  }, [frame, src, sel]);

  const pointToImage = (clientX: number, clientY: number) => {
    const el = boxRef.current;
    if (!el || !src) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    // Map through the padding box (getBoundingClientRect includes the border) and
    // through the object-contain letterbox, or the drag drifts from the cursor.
    const cw = el.clientWidth;
    const ch = el.clientHeight;
    const scale = Math.min(cw / src.w, ch / src.h) || 1;
    const ox = r.left + el.clientLeft + (cw - src.w * scale) / 2;
    const oy = r.top + el.clientTop + (ch - src.h * scale) / 2;
    return {
      x: clamp((clientX - ox) / scale, 0, src.w),
      y: clamp((clientY - oy) / scale, 0, src.h),
    };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!src) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStart.current = pointToImage(e.clientX, e.clientY);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const s = dragStart.current;
    if (!s) return;
    const p = pointToImage(e.clientX, e.clientY);
    commit({
      x: Math.min(s.x, p.x),
      y: Math.min(s.y, p.y),
      w: Math.abs(p.x - s.x),
      h: Math.abs(p.y - s.y),
    });
  };
  const onPointerUp = () => {
    dragStart.current = null;
    if (src && (sel.w < 4 || sel.h < 4)) commit({ x: 0, y: 0, w: src.w, h: src.h });
  };

  const pct = (a: number, b: number) => `${(a / b) * 100}%`;

  const go = () =>
    run("Cropping", async () => {
      if (!file) throw new Error("Choose a file first.");
      if (!src) throw new Error("Still reading the source dimensions — try again in a moment.");
      if (sel.w < 1 || sel.h < 1) throw new Error("The crop area must be at least 1×1 pixels.");
      const ext = outExt(file.name);
      const isVideo = ext === "mp4" || ext === "webm";
      const w = isVideo ? Math.max(2, sel.w - (sel.w % 2)) : sel.w;
      const h = isVideo ? Math.max(2, sel.h - (sel.h % 2)) : sel.h;
      const crop = `crop=${w}:${h}:${sel.x}:${sel.y}`;
      const out = await ffmpegOnce(
        file,
        `in.${ext}`,
        `out.${ext}`,
        ({ input, output }) =>
          ext === "gif"
            ? paletteGifArgs({ input, output, filters: crop })
            : ["-i", input, "-vf", crop, output],
        { onProgress: (r) => setProgress(r) },
      );
      publish({ data: out, ext, note: `${w}x${h} at ${sel.x},${sel.y}` });
    });

  const isVideoFile = !!file?.type.startsWith("video/");

  useAutoRun(go, [file, sel, ratioKey], !!file && !!src);
  return (
    <>
      {url && src ? (
        <div
          ref={boxRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="relative select-none touch-none border border-border bg-smui-surface-0 mx-auto w-full max-w-md cursor-crosshair"
          style={{ aspectRatio: `${src.w} / ${src.h}` }}
          aria-hidden="true"
        >
          {isVideoFile ? (
            <video
              src={url}
              muted
              loop
              autoPlay
              playsInline
              className="pointer-events-none block h-full w-full object-contain"
            />
          ) : (
            <img
              src={url}
              alt=""
              draggable={false}
              className="pointer-events-none block h-full w-full object-contain"
            />
          )}
          <div
            className="absolute border-2 border-[hsl(var(--smui-green))] bg-[hsl(var(--smui-green))]/15"
            style={{
              left: pct(sel.x, src.w),
              top: pct(sel.y, src.h),
              width: pct(sel.w, src.w),
              height: pct(sel.h, src.h),
            }}
          />
        </div>
      ) : null}

      <p className="text-ui text-muted-foreground">
        Drag on the preview to draw a crop area, or type exact pixels below.
      </p>

      {src ? (
        <div>
          <Label>cropped result</Label>
          <div className="flex items-center gap-4 border border-border p-3">
            <div className="checkerboard shrink-0 border border-border">
              <canvas
                ref={canvasRef}
                width={PREVIEW}
                height={PREVIEW}
                className="block size-32"
                role="img"
                aria-label={`Live preview of the crop: ${sel.w} by ${sel.h} pixels, taken from ${sel.x},${sel.y}`}
              />
            </div>
            <p className="text-ui text-muted-foreground min-w-0">
              {sel.w}×{sel.h} px
            </p>
          </div>
        </div>
      ) : null}

      <div>
        <Label htmlFor="crop-ratio">aspect ratio</Label>
        <Select id="crop-ratio" value={ratioKey} onChange={(e) => setRatioKey(e.target.value)}>
          {Object.keys(RATIOS).map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <div>
          <Label htmlFor="crop-x">x (px)</Label>
          <Input
            id="crop-x"
            type="number"
            min={0}
            value={sel.x}
            onChange={(e) => commit({ ...sel, x: Number(e.target.value) })}
          />
        </div>
        <div>
          <Label htmlFor="crop-y">y (px)</Label>
          <Input
            id="crop-y"
            type="number"
            min={0}
            value={sel.y}
            onChange={(e) => commit({ ...sel, y: Number(e.target.value) })}
          />
        </div>
        <div>
          <Label htmlFor="crop-w">width (px)</Label>
          <Input
            id="crop-w"
            type="number"
            min={1}
            value={sel.w}
            onChange={(e) => commit({ ...sel, w: Number(e.target.value) })}
          />
        </div>
        <div>
          <Label htmlFor="crop-h">height (px)</Label>
          <Input
            id="crop-h"
            type="number"
            min={1}
            value={sel.h}
            disabled={!!ratio}
            aria-describedby={ratio ? "crop-h-hint" : undefined}
            onChange={(e) => commit({ ...sel, h: Number(e.target.value) })}
          />
          {ratio ? (
            <p id="crop-h-hint" className="text-label text-muted-foreground mt-1">
              Set by the {ratioKey} ratio.
            </p>
          ) : null}
        </div>
      </div>

      <p className="text-ui text-muted-foreground" role="status" aria-live="polite">
        {src
          ? `Source ${src.w}×${src.h} → crop ${sel.w}×${sel.h} at ${sel.x},${sel.y}`
          : failed
            ? NO_PREVIEW
            : "Choose a file to read its dimensions."}
      </p>
    </>
  );
}

export default function CropTool() {
  return (
    <ToolShell
      tool={tool}
      defaultName="cropped"
      hint="Drag a box over the preview or type the exact pixels. Animated GIFs stay animated."
    >
      {(props) => <Body {...props} />}
    </ToolShell>
  );
}
