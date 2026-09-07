"use client";
import * as React from "react";
import { zipSync } from "fflate";
import { Button } from "@/components/ui/button";
import { ToolShell, useRun, type ToolBodyProps } from "@/components/tool-shell";
import { frameNames, withFFmpeg } from "@/lib/engines/ffmpeg";
import { getTool } from "@/lib/tools";

const tool = getTool("split");

// ponytail: hard cap so a long animation can't exhaust the wasm heap.
// Raise it (or stream frames out) if anyone actually splits 1000-frame GIFs.
const MAX_FRAMES = 500;

function Body({ file, setBusy, setProgress, setError, publish }: ToolBodyProps) {
  const run = useRun({ setBusy, setError, setProgress });
  const [thumbs, setThumbs] = React.useState<string[]>([]);

  // Revoke the previous batch of object URLs whenever a new one replaces it.
  React.useEffect(() => () => thumbs.forEach((u) => URL.revokeObjectURL(u)), [thumbs]);

  // A new file means the old frame grid is stale.
  React.useEffect(() => setThumbs([]), [file]);

  const go = () =>
    run("Extracting frames", async () => {
      if (!file) throw new Error("Choose an animated GIF or WebP first.");
      const ext = file.name.split(".").pop()?.toLowerCase() || "gif";
      const input = `in.${ext}`;
      await withFFmpeg(async (ff) => {
        try {
          await ff.writeFile(input, new Uint8Array(await file.arrayBuffer()));
          setProgress(0.2);
          const code = await ff.exec(["-i", input, "-vsync", "0", "frame-%04d.png"]);
          if (code !== 0)
            throw new Error("ffmpeg could not decode that file. Is it a real GIF or WebP?");

          const names = await frameNames(ff);
          if (names.length === 0)
            throw new Error("No frames came out — the file may have no image data.");
          if (names.length > MAX_FRAMES) {
            throw new Error(
              `That file has ${names.length} frames; the limit is ${MAX_FRAMES}. Trim it first.`,
            );
          }

          setProgress(0.6);
          const files: Record<string, Uint8Array> = {};
          const urls: string[] = [];
          for (const name of names) {
            const data = await ff.readFile(name);
            if (typeof data === "string") throw new Error(`Unexpected text output for ${name}.`);
            const bytes = data as Uint8Array;
            files[name] = bytes;
            urls.push(
              URL.createObjectURL(
                new Blob([bytes.slice().buffer as ArrayBuffer], { type: "image/png" }),
              ),
            );
          }
          setThumbs(urls);
          setProgress(0.9);
          publish({
            data: zipSync(files),
            ext: "zip",
            mime: "application/zip",
            note: `${names.length} frames as PNG`,
          });
          setProgress(1);
        } finally {
          // Delete by pattern, not by what this run recorded: a failed exec can
          // still have written frames, and they would land in the next run's ZIP.
          for (const name of [input, ...(await frameNames(ff))]) {
            try {
              await ff.deleteFile(name);
            } catch {
              /* already gone */
            }
          }
        }
      });
    });

  return (
    <>
      <Button onClick={go} disabled={!file}>
        Split into frames
      </Button>

      {/* Only the summary is live; 500 thumbnails inside the region would be
          read out one by one. The count is the announcement. */}
      <div role="status" aria-live="polite">
        {thumbs.length ? (
          <p className="text-ui text-[hsl(var(--smui-green))] mb-2">
            {thumbs.length} frames extracted. Download the ZIP on the right.
          </p>
        ) : null}
      </div>

      {thumbs.length ? (
        <ul className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {thumbs.map((url, i) => (
            <li key={url} className="border border-border bg-smui-surface-0 p-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="w-full h-auto" />
              <span className="block text-label text-muted-foreground tabular-nums text-center mt-1">
                {i + 1}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

export default function SplitTool() {
  return (
    <ToolShell
      tool={tool}
      accept="image/gif,image/webp,image/apng,image/png,video/*"
      defaultName="frames"
      hint="Every frame is decoded to a lossless PNG and packed into a ZIP."
    >
      {(props) => <Body {...props} />}
    </ToolShell>
  );
}
