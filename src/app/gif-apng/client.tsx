"use client";
import * as React from "react";
import { Range, Readout } from "@/components/ui/field";
import { ToolShell, useAutoRun, useRun, type ToolBodyProps } from "@/components/tool-shell";
import { ffmpegOnce, paletteGifArgs } from "@/lib/engines/ffmpeg";
import { getTool } from "@/lib/tools";

const tool = getTool("gif-apng");

function Body({ file, setBusy, setProgress, setError, publish }: ToolBodyProps) {
  const run = useRun({ setBusy, setError, setProgress });
  const [colors, setColors] = React.useState(256);

  // A GIF goes to APNG; anything else (APNG, PNG) comes back as a GIF.
  const fromGif = !!file && (file.type === "image/gif" || /\.gif$/i.test(file.name));
  const target = fromGif ? "apng" : "gif";

  const go = () =>
    run(`Converting to ${target.toUpperCase()}`, async () => {
      if (!file) throw new Error("Choose a GIF or APNG first.");
      const input = fromGif ? "in.gif" : "in.png";
      const out = await ffmpegOnce(
        file,
        input,
        `out.${fromGif ? "png" : "gif"}`,
        ({ input, output }) =>
          fromGif
            ? ["-i", input, "-f", "apng", "-plays", "0", output]
            : paletteGifArgs({ input, output, filters: "null", colors }),
        { onProgress: setProgress },
      );
      publish({
        data: out,
        ext: fromGif ? "png" : "gif",
        note: fromGif ? "gif → apng" : "apng → gif",
      });
    });

  useAutoRun(go, [file, colors], !!file);
  return (
    <>
      {!fromGif && file ? (
        <Range
          label="max colors"
          min={2}
          max={256}
          step={2}
          value={colors}
          onChange={(e) => setColors(Number(e.target.value))}
        />
      ) : null}
      <Readout
        rows={[
          ["direction", file ? (fromGif ? "GIF → APNG" : "APNG → GIF") : "—"],
          [
            "colors",
            !file ? "—" : fromGif ? "kept as-is, full alpha" : `up to ${colors}, 1-bit alpha`,
          ],
        ]}
      />
    </>
  );
}

export default function GifApngTool() {
  return (
    <ToolShell
      tool={tool}
      accept="image/gif,image/png,image/apng"
      defaultName="converted"
      hint="Drop a GIF to get an APNG, or an APNG to get a GIF. Timing and looping are kept."
    >
      {(props) => <Body {...props} />}
    </ToolShell>
  );
}
