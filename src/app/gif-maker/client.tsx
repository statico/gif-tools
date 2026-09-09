"use client";
import * as React from "react";
import { ChevronLeft, ChevronRight, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ColorField, Input, Label, Select } from "@/components/ui/field";
import { ToolShell, useRun, type ToolBodyProps } from "@/components/tool-shell";
import { encodeGif, loadImage, renderFrames } from "@/lib/engines/gif-encode";
import { getTool } from "@/lib/tools";
import { clamp } from "@/lib/utils";

const tool = getTool("gif-maker");

interface Frame {
  id: string;
  name: string;
  url: string;
  img: HTMLImageElement;
}

type Fit = "contain" | "cover" | "stretch";

/** Where to draw `img` inside a w×h canvas for the chosen fit mode. */
function placement(img: HTMLImageElement, w: number, h: number, fit: Fit) {
  const iw = img.naturalWidth || 1;
  const ih = img.naturalHeight || 1;
  if (fit === "stretch") return { x: 0, y: 0, w, h };
  const scale = fit === "cover" ? Math.max(w / iw, h / ih) : Math.min(w / iw, h / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  return { x: (w - dw) / 2, y: (h - dh) / 2, w: dw, h: dh };
}

/** Output size: the first frame's aspect ratio at the chosen width. */
function outputSize(frames: Frame[], width: number) {
  const w = clamp(Math.round(width), 16, 2000);
  const first = frames[0]?.img;
  const ratio = first ? (first.naturalHeight || 1) / (first.naturalWidth || 1) : 1;
  return { w, h: Math.max(1, Math.round(w * ratio)) };
}

/** Draw one frame exactly as the encode will. Preview and export share this. */
function drawFrame(
  ctx: CanvasRenderingContext2D,
  frames: Frame[],
  i: number,
  w: number,
  h: number,
  fit: Fit,
  bg: string,
) {
  ctx.clearRect(0, 0, w, h);
  if (fit === "contain") {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
  }
  const p = placement(frames[i].img, w, h, fit);
  ctx.drawImage(frames[i].img, p.x, p.y, p.w, p.h);
}

/**
 * Files from a drop, descending into dropped folders. Folder contents come
 * back sorted numerically (frame2 before frame10) since that's the frame order
 * anyone exporting a sequence expects; loose files keep their drop order.
 */
async function filesFromDrop(dt: DataTransfer): Promise<File[]> {
  const entries = Array.from(dt.items, (i) => i.webkitGetAsEntry?.() ?? null);
  if (!entries.some(Boolean)) return Array.from(dt.files);
  const byName = (a: { name: string }, b: { name: string }) =>
    a.name.localeCompare(b.name, undefined, { numeric: true });
  const walk = async (entry: FileSystemEntry | null): Promise<File[]> => {
    if (!entry) return [];
    if (entry.isFile) {
      return [await new Promise<File>((ok, err) => (entry as FileSystemFileEntry).file(ok, err))];
    }
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    const children: FileSystemEntry[] = [];
    // readEntries returns in batches (Chrome caps at 100); drain it.
    for (;;) {
      const batch = await new Promise<FileSystemEntry[]>((ok, err) => reader.readEntries(ok, err));
      if (!batch.length) break;
      children.push(...batch);
    }
    children.sort(byName);
    const out: File[] = [];
    for (const c of children) out.push(...(await walk(c)));
    return out;
  };
  const out: File[] = [];
  for (const e of entries) out.push(...(await walk(e)));
  return out;
}

function Body({ setBusy, setProgress, setError, publish }: ToolBodyProps) {
  const run = useRun({ setBusy, setError, setProgress });
  const [frames, setFrames] = React.useState<Frame[]>([]);
  const [delay, setDelay] = React.useState(120);
  const [loop, setLoop] = React.useState(0);
  const [width, setWidth] = React.useState(480);
  const [fit, setFit] = React.useState<Fit>("contain");
  const [bg, setBg] = React.useState("#000000");
  const [dragging, setDragging] = React.useState(false);
  // Index of the frame card being dragged, and the slot it is hovering over.
  const [dragFrom, setDragFrom] = React.useState<number | null>(null);
  const [dragOver, setDragOver] = React.useState<number | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const addFiles = React.useCallback(
    async (list: FileList | File[] | null) => {
      const files = Array.from(list ?? []).filter((f) => f.type.startsWith("image/"));
      if (!files.length) {
        setError("Those files aren't images. Pick PNG, JPEG, WebP or GIF files.");
        return;
      }
      setError(null);
      // Keep whatever decoded: one bad file in a drop of ten used to throw the
      // other nine away and strand their object URLs for the life of the tab.
      const added: Frame[] = [];
      const failed: string[] = [];
      for (const f of files) {
        const url = URL.createObjectURL(f);
        try {
          added.push({
            id: `${f.name}-${Date.now()}-${Math.random()}`,
            name: f.name,
            url,
            img: await loadImage(f),
          });
        } catch {
          URL.revokeObjectURL(url);
          failed.push(f.name);
        }
      }
      if (added.length) setFrames((prev) => [...prev, ...added]);
      if (failed.length) setError(`Could not read ${failed.join(", ")}.`);
    },
    [setError],
  );

  const reorder = (from: number, to: number) =>
    setFrames((prev) => {
      if (from === to || to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [f] = next.splice(from, 1);
      next.splice(to, 0, f);
      return next;
    });
  const move = (i: number, dir: -1 | 1) => reorder(i, i + dir);

  // Loop the assembled animation at the real frame delay, so reordering a
  // frame or changing the fit shows up immediately rather than after an encode.
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const { w: outW, h: outH } = outputSize(frames, width);
  React.useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !frames.length) return;
    let i = 0;
    const paint = () => drawFrame(ctx, frames, i % frames.length, outW, outH, fit, bg);
    paint();
    if (frames.length === 1) return;
    const id = setInterval(
      () => {
        i += 1;
        paint();
      },
      clamp(Math.round(delay), 20, 5000),
    );
    return () => clearInterval(id);
  }, [frames, outW, outH, fit, bg, delay]);

  // Unmounting must release every object URL; individual deletes only cover one.
  const framesRef = React.useRef(frames);
  framesRef.current = frames;
  React.useEffect(() => () => framesRef.current.forEach((f) => URL.revokeObjectURL(f.url)), []);

  const remove = (i: number) =>
    setFrames((prev) => {
      URL.revokeObjectURL(prev[i].url);
      return prev.filter((_, k) => k !== i);
    });

  const go = () =>
    run("Building GIF", async () => {
      if (!frames.length) throw new Error("Add at least one image first.");
      const { w, h } = outputSize(frames, width);
      const ms = clamp(Math.round(delay), 20, 5000);

      setProgress(0.3);
      const imageData = renderFrames({ width: w, height: h }, frames.length, (ctx, _t, i) =>
        drawFrame(ctx, frames, i, w, h, fit, bg),
      );
      setProgress(0.7);
      const data = encodeGif(imageData, {
        delayMs: ms,
        loop: clamp(Math.round(loop), 0, 65535),
        transparent: false,
      });
      setProgress(1);
      publish({
        data,
        ext: "gif",
        note: `${frames.length} frames · ${ms}ms · ${w}px · ${fit}`,
      });
    });

  return (
    <>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          // A frame card dragged over this zone is not a file drop.
          if (e.dataTransfer.types.includes("Files")) {
            void filesFromDrop(e.dataTransfer).then(addFiles);
          }
        }}
        className={`border border-dashed p-6 text-center transition-colors ${
          dragging ? "border-primary bg-accent" : "border-border"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="sr-only"
          id="gif-maker-files"
          aria-label="Choose images to turn into GIF frames"
          onChange={(e) => {
            void addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <Upload className="mx-auto mb-2 size-5 text-muted-foreground" aria-hidden="true" />
        <p className="text-ui text-foreground mb-1">Drop several images, or a folder, here</p>
        <p className="text-label text-muted-foreground mb-3">
          they become frames in the order you add them — nothing leaves your device
        </p>
        <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
          Choose images
        </Button>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <Label className="mb-0" id="gif-maker-frames-label">
            frames
          </Label>
          <span className="text-label text-muted-foreground tabular-nums" aria-live="polite">
            {frames.length} added
          </span>
        </div>
        {frames.length ? (
          <ul
            aria-labelledby="gif-maker-frames-label"
            className="grid grid-cols-[repeat(auto-fill,minmax(6rem,1fr))] gap-1.5"
          >
            {frames.map((f, i) => (
              <li
                key={f.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "move";
                  setDragFrom(i);
                }}
                onDragOver={(e) => {
                  if (dragFrom === null) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setDragOver(i);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragFrom !== null) reorder(dragFrom, i);
                  setDragFrom(null);
                  setDragOver(null);
                }}
                onDragEnd={() => {
                  setDragFrom(null);
                  setDragOver(null);
                }}
                className={`group relative border bg-smui-surface-0 p-1 cursor-grab active:cursor-grabbing ${
                  dragOver === i && dragFrom !== i ? "border-primary" : "border-border"
                } ${dragFrom === i ? "opacity-40" : ""}`}
              >
                <img
                  src={f.url}
                  alt=""
                  draggable={false}
                  className="checkerboard aspect-square w-full object-contain"
                />
                <span className="absolute top-1 left-1 bg-background/80 px-1 text-label text-foreground tabular-nums">
                  {i + 1}
                </span>
                <span
                  className="block truncate text-label text-muted-foreground mt-1"
                  title={f.name}
                >
                  {f.name}
                </span>
                <span className="absolute top-1 right-1 flex gap-px opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-6 bg-background/90"
                    aria-label={`Move frame ${i + 1} earlier`}
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                  >
                    <ChevronLeft aria-hidden="true" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-6 bg-background/90"
                    aria-label={`Move frame ${i + 1} later`}
                    disabled={i === frames.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    <ChevronRight aria-hidden="true" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-6 bg-background/90"
                    aria-label={`Delete frame ${i + 1}`}
                    onClick={() => remove(i)}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ui text-muted-foreground">No frames yet.</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="gm-delay">frame delay (ms)</Label>
          <Input
            id="gm-delay"
            type="number"
            min={20}
            max={5000}
            step={10}
            value={delay}
            onChange={(e) => setDelay(Number(e.target.value))}
          />
        </div>
        <div>
          <Label htmlFor="gm-loop">loop count (0 = forever)</Label>
          <Input
            id="gm-loop"
            type="number"
            min={0}
            max={100}
            step={1}
            value={loop}
            onChange={(e) => setLoop(Number(e.target.value))}
          />
        </div>
        <div>
          <Label htmlFor="gm-width">output width (px)</Label>
          <Input
            id="gm-width"
            type="number"
            min={16}
            max={2000}
            step={1}
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
            aria-describedby="gm-width-hint"
          />
          <p id="gm-width-hint" className="text-label text-muted-foreground mt-1">
            Height follows the first frame&apos;s aspect ratio.
          </p>
        </div>
        <div>
          <Label htmlFor="gm-fit">fit mode</Label>
          <Select id="gm-fit" value={fit} onChange={(e) => setFit(e.target.value as Fit)}>
            <option value="contain">contain — whole image, padded</option>
            <option value="cover">cover — fill the frame, crop edges</option>
            <option value="stretch">stretch — distort to fit</option>
          </Select>
        </div>
      </div>

      {fit === "contain" ? (
        <ColorField id="gm-bg" label="background colour" value={bg} onChange={setBg} />
      ) : null}

      <div>
        <Label>live preview</Label>
        <div className="checkerboard flex min-h-32 items-center justify-center border border-border p-3">
          {frames.length ? (
            <canvas
              ref={canvasRef}
              width={outW}
              height={outH}
              role="img"
              aria-label={`Looping preview of ${frames.length} frame${
                frames.length === 1 ? "" : "s"
              } at ${outW} by ${outH} pixels`}
              className="max-h-60 max-w-full"
            />
          ) : (
            <p className="text-ui text-muted-foreground">Add images to see them play.</p>
          )}
        </div>
        {frames.length ? (
          <p className="text-label text-muted-foreground tabular-nums mt-1">
            {`${outW} × ${outH} · ${frames.length} frame${frames.length === 1 ? "" : "s"} · ${Math.max(
              20,
              Math.round(delay),
            )}ms each · ${(Math.max(20, Math.round(delay)) * frames.length) / 1000}s total`}
          </p>
        ) : null}
      </div>

      <Button onClick={go} disabled={!frames.length}>
        Build GIF
      </Button>
    </>
  );
}

export default function GifMakerTool() {
  return (
    <ToolShell
      tool={tool}
      requiresFile={false}
      defaultName="animation"
      hint="Add images, put them in the order you want, then set the delay. Every frame is drawn at the same size using the fit mode you pick."
    >
      {(props) => <Body {...props} />}
    </ToolShell>
  );
}
