"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Label, Range, Readout, Select } from "@/components/ui/field";
import { ToolShell, useRun, type ToolBodyProps } from "@/components/tool-shell";
import { optimizeGif } from "@/lib/engines/gifsicle";
import { useFirstFrame } from "@/lib/preview";
import { getTool } from "@/lib/tools";
import { formatBytes } from "@/lib/utils";

const tool = getTool("optimize");

function Body({ file, setBusy, setProgress, setError, publish }: ToolBodyProps) {
  const run = useRun({ setBusy, setError, setProgress });
  const [level, setLevel] = React.useState<1 | 2 | 3>(3);
  const [lossy, setLossy] = React.useState(60);
  const [useLossy, setUseLossy] = React.useState(true);
  const [colors, setColors] = React.useState(256);
  const [saving, setSaving] = React.useState<{ text: string; pct: number } | null>(null);
  // Shared with the preview tools: one browser decode, and it reports failure
  // instead of leaving the readout on "reading…" forever.
  const { size: dims, failed } = useFirstFrame(file);

  React.useEffect(() => setSaving(null), [file]);

  // gifsicle only gets --colors when it is below 256, and no --scale at all.
  const lossyWords =
    lossy <= 40
      ? "barely visible"
      : lossy <= 80
        ? "slight noise"
        : lossy <= 140
          ? "visible noise"
          : "heavy artifacts";
  const readout: [string, string][] = [
    ["size", dims ? `${dims.w} × ${dims.h} px` : !file ? "—" : failed ? "unknown" : "reading…"],
    ["format", ".gif"],
    ["colors", colors < 256 ? `reduced to ${colors}` : "palette unchanged"],
    ["lossy", useLossy ? `${lossy} — ${lossyWords}` : "off"],
    [
      "effort",
      level === 1 ? "changed areas only" : level === 2 ? "+ transparency reuse" : "every method",
    ],
  ];

  const go = () =>
    run("Optimizing", async () => {
      setSaving(null); // a failed run must not leave the last file's result on screen
      if (!file) throw new Error("Choose a GIF first.");
      setProgress(0.3);
      const out = await optimizeGif(file, {
        level,
        lossy: useLossy ? lossy : undefined,
        colors,
      });
      setProgress(1);
      const pct = Math.round((1 - out.length / file.size) * 100);
      setSaving({
        text: `${formatBytes(file.size)} → ${formatBytes(out.length)} (${pct >= 0 ? `${pct}% smaller` : `${-pct}% larger`})`,
        pct,
      });
      publish({
        data: out,
        ext: "gif",
        note: `-O${level}${useLossy ? ` lossy=${lossy}` : ""} colors=${colors}`,
      });
    });

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="opt-level">optimization level</Label>
          <Select
            id="opt-level"
            value={level}
            onChange={(e) => setLevel(Number(e.target.value) as 1 | 2 | 3)}
          >
            <option value={1}>1 — store only changed areas</option>
            <option value={2}>2 — also reuse transparency</option>
            <option value={3}>3 — try everything (slowest)</option>
          </Select>
        </div>
        <Range
          label="colors"
          min={2}
          max={256}
          step={1}
          value={colors}
          onChange={(e) => setColors(Number(e.target.value))}
        />
      </div>

      <div className="grid gap-3">
        <Checkbox
          label="Lossy compression (much smaller, slightly noisier)"
          checked={useLossy}
          onChange={(e) => setUseLossy(e.target.checked)}
        />
        {useLossy ? (
          <Range
            label="lossy amount"
            min={10}
            max={200}
            step={5}
            value={lossy}
            onChange={(e) => setLossy(Number(e.target.value))}
          />
        ) : null}
      </div>

      <Readout rows={readout} />

      {saving ? (
        <p
          role="status"
          className={`text-ui ${
            saving.pct >= 0 ? "text-[hsl(var(--smui-green))]" : "text-[hsl(var(--smui-yellow))]"
          }`}
        >
          {saving.text}
        </p>
      ) : null}

      <Button onClick={go} disabled={!file}>
        Optimize GIF
      </Button>
    </>
  );
}

export default function OptimizeTool() {
  return (
    <ToolShell
      tool={tool}
      accept="image/gif"
      defaultName="optimized"
      hint="gifsicle rewrites the GIF so frames only store what changed. Lossy mode trades a little quality for a much smaller file."
    >
      {(props) => <Body {...props} />}
    </ToolShell>
  );
}
