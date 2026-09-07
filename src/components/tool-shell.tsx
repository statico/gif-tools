"use client";
import * as React from "react";
import { AlertTriangle, Download, Loader2, RotateCcw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/field";
import { download, mimeFor } from "@/lib/download";
import { addToHistory } from "@/lib/history";
import { formatBytes, slugify } from "@/lib/utils";
import type { Tool } from "@/lib/tools";

export interface ToolResult {
  data: Uint8Array;
  /** Extension without the dot, e.g. "gif". */
  ext: string;
  /** Optional summary of the settings, shown in history. */
  note?: string;
  /** Overrides the preview mime if it differs from the extension. */
  mime?: string;
}

/** Everything a tool body needs from the shell. */
export interface ToolBodyProps {
  file: File | null;
  setBusy: (busy: boolean, message?: string) => void;
  setProgress: (ratio: number) => void;
  setError: (message: string | null) => void;
  /** Publish a result: shows the preview, enables download, saves to history. */
  publish: (result: ToolResult) => void;
}

interface ToolShellProps {
  tool: Tool;
  /** MIME/extension hints for the file picker. Omit for generator tools. */
  accept?: string;
  /** Generators (number, text emoji) need no input file. */
  requiresFile?: boolean;
  /** Default download filename stem. */
  defaultName?: string;
  children: (props: ToolBodyProps) => React.ReactNode;
  /** Short usage note rendered under the heading. */
  hint?: React.ReactNode;
}

export function ToolShell({
  tool,
  accept = "image/gif,image/png,image/jpeg,image/webp,video/*",
  requiresFile = true,
  defaultName,
  children,
  hint,
}: ToolShellProps) {
  const [file, setFile] = React.useState<File | null>(null);
  const [result, setResult] = React.useState<ToolResult | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [sourceUrl, setSourceUrl] = React.useState<string | null>(null);
  const [busy, setBusyState] = React.useState(false);
  const [busyMessage, setBusyMessage] = React.useState<string>();
  const [progress, setProgress] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [name, setName] = React.useState(defaultName ?? tool.slug);
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Object URLs are revoked whenever they're replaced, so long sessions with
  // many runs don't pin every previous result in memory.
  React.useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  React.useEffect(() => () => { if (sourceUrl) URL.revokeObjectURL(sourceUrl); }, [sourceUrl]);

  const setBusy = React.useCallback((b: boolean, message?: string) => {
    setBusyState(b);
    setBusyMessage(message);
    if (!b) setProgress(0);
  }, []);

  const publish = React.useCallback(
    (r: ToolResult) => {
      const mime = r.mime ?? mimeFor(`x.${r.ext}`);
      const blob = new Blob([r.data.slice().buffer as ArrayBuffer], { type: mime });
      setResult(r);
      setPreviewUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(blob);
      });
      const filename = `${slugify(name, tool.slug)}.${r.ext}`;
      void addToHistory(
        { tool: tool.slug, toolName: tool.name, filename, mime, note: r.note },
        blob,
      );
    },
    [name, tool.slug, tool.name],
  );

  const onPick = React.useCallback(
    (f: File | null) => {
      if (!f) return;
      setFile(f);
      setResult(null);
      setError(null);
      setSourceUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(f);
      });
      // Seed the download name from the source so it stays recognisable.
      const stem = f.name.replace(/\.[^.]+$/, "");
      if (stem) setName(slugify(stem, tool.slug));
    },
    [tool.slug],
  );

  const resultMime = result ? result.mime ?? mimeFor(`x.${result.ext}`) : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] items-start">
      <div className="grid gap-4 min-w-0">
        {requiresFile ? (
          <Card>
            <CardHeader>
              <CardTitle>source</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  onPick(e.dataTransfer.files?.[0] ?? null);
                }}
                className={`border border-dashed p-6 text-center transition-colors ${
                  dragging ? "border-primary bg-accent" : "border-border"
                }`}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept={accept}
                  className="sr-only"
                  id={`${tool.slug}-file`}
                  onChange={(e) => onPick(e.target.files?.[0] ?? null)}
                />
                <Upload className="mx-auto mb-2 size-5 text-muted-foreground" aria-hidden="true" />
                <p className="text-ui text-foreground mb-1">
                  {file ? file.name : "Drop a file here"}
                </p>
                <p className="text-label text-muted-foreground mb-3">
                  {file ? formatBytes(file.size) : "or choose one — nothing leaves your device"}
                </p>
                <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
                  {file ? "Choose another" : "Choose file"}
                </Button>
              </div>

              {sourceUrl && file?.type.startsWith("image/") ? (
                <img
                  src={sourceUrl}
                  alt={`Source preview of ${file.name}`}
                  className="mt-3 max-h-64 mx-auto border border-border"
                />
              ) : null}
              {sourceUrl && file?.type.startsWith("video/") ? (
                <video
                  src={sourceUrl}
                  controls
                  className="mt-3 max-h-64 mx-auto border border-border"
                />
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>settings</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {hint ? <p className="text-ui text-muted-foreground">{hint}</p> : null}
            {children({ file, setBusy, setProgress, setError, publish })}
          </CardContent>
        </Card>
      </div>

      <Card className="lg:sticky lg:top-16">
        <CardHeader>
          <CardTitle>result</CardTitle>
          {busy ? (
            <span className="text-label text-[hsl(var(--smui-yellow))] tracking-wider uppercase">
              working
            </span>
          ) : result ? (
            <span className="text-label text-[hsl(var(--smui-green))] tracking-wider uppercase">
              ready
            </span>
          ) : null}
        </CardHeader>
        <CardContent className="grid gap-3">
          <div
            role="status"
            aria-live="polite"
            aria-busy={busy}
            className="min-h-40 flex items-center justify-center border border-border bg-smui-surface-0 p-3"
          >
            {busy ? (
              <div className="text-center">
                <Loader2 className="mx-auto mb-2 size-5 animate-spin text-primary" aria-hidden="true" />
                <p className="text-ui text-foreground">{busyMessage ?? "Processing"}</p>
                <p className="text-label text-muted-foreground tabular-nums">
                  {Math.round(progress * 100)}%
                </p>
              </div>
            ) : previewUrl && resultMime?.startsWith("video/") ? (
              <video src={previewUrl} controls loop className="max-h-72 max-w-full" />
            ) : previewUrl && resultMime?.startsWith("image/") ? (
              <img
                src={previewUrl}
                alt={`Result from the ${tool.name} tool`}
                className="max-h-72 max-w-full"
              />
            ) : previewUrl ? (
              <p className="text-ui text-muted-foreground">
                {result?.ext.toUpperCase()} ready to download
              </p>
            ) : (
              <p className="text-ui text-muted-foreground text-center">
                Nothing yet. {requiresFile ? "Pick a file and run the tool." : "Run the tool."}
              </p>
            )}
          </div>

          {error ? (
            <div
              role="alert"
              className="flex gap-2 border border-destructive/40 bg-destructive/5 p-2.5 text-ui text-foreground"
            >
              <AlertTriangle className="size-4 shrink-0 text-destructive mt-0.5" aria-hidden="true" />
              <span>{error}</span>
            </div>
          ) : null}

          <div>
            <Label htmlFor={`${tool.slug}-name`}>filename</Label>
            <div className="flex gap-2">
              <Input
                id={`${tool.slug}-name`}
                value={name}
                spellCheck={false}
                onChange={(e) => setName(e.target.value)}
                aria-describedby={`${tool.slug}-name-hint`}
              />
              <span className="flex items-center text-ui text-muted-foreground">
                .{result?.ext ?? "gif"}
              </span>
            </div>
            <p id={`${tool.slug}-name-hint`} className="text-label text-muted-foreground mt-1">
              Saved as <code className="text-foreground">{slugify(name, tool.slug)}.{result?.ext ?? "gif"}</code> — a
              valid Slack emoji name.
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              className="flex-1"
              disabled={!result}
              onClick={() =>
                result &&
                download(
                  result.data,
                  `${slugify(name, tool.slug)}.${result.ext}`,
                  resultMime ?? undefined,
                )
              }
            >
              <Download aria-hidden="true" />
              Download{result ? ` · ${formatBytes(result.data.length)}` : ""}
            </Button>
            {result ? (
              <Button
                variant="outline"
                size="icon"
                aria-label="Clear result"
                onClick={() => { setResult(null); setPreviewUrl(null); }}
              >
                <RotateCcw aria-hidden="true" />
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** Wraps a tool action with busy/error plumbing so pages don't repeat it. */
export function useRun(props: Pick<ToolBodyProps, "setBusy" | "setError" | "setProgress">) {
  const { setBusy, setError, setProgress } = props;
  return React.useCallback(
    async (message: string, fn: () => Promise<void>) => {
      setError(null);
      setBusy(true, message);
      setProgress(0);
      try {
        await fn();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [setBusy, setError, setProgress],
  );
}
