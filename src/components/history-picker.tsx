"use client";
import * as React from "react";
import { History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getBlob, readIndex, type HistoryEntry } from "@/lib/history";

/**
 * "From history" button that unfolds a grid of earlier results. Picking one
 * hands the caller a File, the same shape a drop or the file input produces.
 */
export function HistoryPicker({
  onPick,
  video = false,
  label = "From history",
}: {
  onPick: (file: File) => void;
  /** Whether video results are offered too. */
  video?: boolean;
  label?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [entries, setEntries] = React.useState<HistoryEntry[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const refresh = () =>
      setEntries(
        readIndex().filter(
          (e) => e.mime.startsWith("image/") || (video && e.mime.startsWith("video/")),
        ),
      );
    refresh();
    window.addEventListener("gif-history-change", refresh);
    return () => window.removeEventListener("gif-history-change", refresh);
  }, [open, video]);

  const pick = async (e: HistoryEntry) => {
    const blob = await getBlob(e.id);
    if (!blob) {
      setError(`The file for ${e.filename} is no longer stored in this browser.`);
      return;
    }
    setError(null);
    setOpen(false);
    onPick(new File([blob], e.filename, { type: e.mime }));
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        aria-expanded={open}
        aria-controls="history-picker"
        onClick={() => setOpen((v) => !v)}
      >
        <History aria-hidden="true" />
        {label}
      </Button>
      {open ? (
        <div id="history-picker" className="mt-3 border border-border bg-smui-surface-0 p-2">
          {error ? (
            <p role="alert" className="text-ui text-destructive mb-2">
              {error}
            </p>
          ) : null}
          {entries.length ? (
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-1.5">
              {entries.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => void pick(e)}
                    title={`${e.filename} · ${e.toolName}`}
                    className="block w-full border border-border bg-card p-1 text-left hover:border-primary focus-visible:border-primary"
                  >
                    <span className="checkerboard flex aspect-square items-center justify-center overflow-hidden">
                      {e.thumbnail ? (
                        <img src={e.thumbnail} alt="" className="max-h-full max-w-full" />
                      ) : (
                        <span className="text-label text-muted-foreground">
                          {e.filename.split(".").pop()?.toUpperCase()}
                        </span>
                      )}
                    </span>
                    <span className="mt-1 block truncate text-label text-muted-foreground">
                      {e.filename}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ui text-muted-foreground">
              Nothing in your history yet. Results from any tool land here.
            </p>
          )}
        </div>
      ) : null}
    </>
  );
}
