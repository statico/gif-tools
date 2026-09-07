"use client";
import * as React from "react";
import { Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { download } from "@/lib/download";
import {
  clearHistory,
  getBlob,
  readIndex,
  removeFromHistory,
  type HistoryEntry,
} from "@/lib/history";
import { formatBytes } from "@/lib/utils";

export default function HistoryClient() {
  const [entries, setEntries] = React.useState<HistoryEntry[] | null>(null);

  const refresh = React.useCallback(() => setEntries(readIndex()), []);

  React.useEffect(() => {
    refresh();
    // Tool pages fire this after saving, so an open history tab stays current.
    window.addEventListener("gif-history-change", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("gif-history-change", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [refresh]);

  // null = not yet read on the client; avoids flashing "empty" during hydration.
  if (entries === null) {
    return (
      <p role="status" className="text-ui text-muted-foreground">
        Loading your history…
      </p>
    );
  }

  if (!entries.length) {
    return (
      <Card>
        <CardContent>
          <p className="text-ui text-muted-foreground">
            Nothing here yet. Anything you make with a tool on this site shows up here
            automatically.
          </p>
        </CardContent>
      </Card>
    );
  }

  const save = async (entry: HistoryEntry) => {
    const blob = await getBlob(entry.id);
    if (blob) download(blob, entry.filename, entry.mime);
  };

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <p className="text-label text-muted-foreground tracking-wider uppercase">
          {entries.length} item{entries.length === 1 ? "" : "s"}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            await clearHistory();
            refresh();
          }}
        >
          <Trash2 aria-hidden="true" />
          Clear all
        </Button>
      </div>

      <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map((e) => (
          <li key={e.id}>
            <Card className="h-full">
              <CardContent className="flex gap-3">
                <div className="size-16 shrink-0 border border-border bg-smui-surface-0 flex items-center justify-center overflow-hidden">
                  {e.thumbnail ? (
                    <img src={e.thumbnail} alt="" className="max-h-full max-w-full" />
                  ) : (
                    <span className="text-label text-muted-foreground">
                      {e.filename.split(".").pop()?.toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-ui text-foreground truncate" title={e.filename}>
                    {e.filename}
                  </p>
                  <p className="text-label text-muted-foreground">
                    {e.toolName} · {formatBytes(e.size)}
                  </p>
                  <p className="text-label text-muted-foreground">
                    <time dateTime={new Date(e.createdAt).toISOString()}>
                      {new Date(e.createdAt).toLocaleString()}
                    </time>
                  </p>
                  {e.note ? (
                    <p className="text-label text-muted-foreground truncate" title={e.note}>
                      {e.note}
                    </p>
                  ) : null}
                  <div className="flex gap-1 mt-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void save(e)}
                      aria-label={`Download ${e.filename}`}
                    >
                      <Download aria-hidden="true" />
                      Save
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Delete ${e.filename}`}
                      onClick={async () => {
                        await removeFromHistory(e.id);
                        refresh();
                      }}
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}
