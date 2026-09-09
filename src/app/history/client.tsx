"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/field";
import { download } from "@/lib/download";
import {
  clearHistory,
  getBlob,
  readIndex,
  removeFromHistory,
  sourceHref,
  stashSource,
  type HistoryEntry,
} from "@/lib/history";
import { TOOLS } from "@/lib/tools";
import { formatBytes } from "@/lib/utils";

// Generators take no input, so there is nothing to open them with.
const OPENERS = TOOLS.filter((t) => !["number", "text-emoji"].includes(t.slug));

export default function HistoryClient() {
  const [entries, setEntries] = React.useState<HistoryEntry[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  // Deleting unmounts the focused button, so focus has to be put somewhere.
  const headingRef = React.useRef<HTMLParagraphElement>(null);
  const refocus = React.useRef(false);

  const refresh = React.useCallback(() => setEntries(readIndex()), []);
  const router = useRouter();

  React.useEffect(() => {
    if (!refocus.current) return;
    refocus.current = false;
    headingRef.current?.focus();
  }, [entries]);

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
          <p ref={headingRef} tabIndex={-1} className="text-ui text-muted-foreground">
            Nothing here yet. Anything you make with a tool on this site shows up here
            automatically.
          </p>
        </CardContent>
      </Card>
    );
  }

  const save = async (entry: HistoryEntry) => {
    const blob = await getBlob(entry.id);
    // The index lives in localStorage and the bytes in IndexedDB; clearing one
    // without the other leaves a row whose file is gone. Say so rather than
    // having the button do nothing at all.
    if (!blob) {
      setError(`The file for ${entry.filename} is no longer stored in this browser.`);
      return;
    }
    setError(null);
    download(blob, entry.filename, entry.mime);
  };

  const openIn = async (entry: HistoryEntry, slug: string) => {
    const blob = await getBlob(entry.id);
    if (!blob) {
      setError(`The file for ${entry.filename} is no longer stored in this browser.`);
      return;
    }
    router.push(sourceHref(slug, await stashSource(blob, entry.filename)));
  };

  return (
    <>
      {error ? (
        <p role="alert" className="text-ui text-destructive mb-3">
          {error}
        </p>
      ) : null}

      <div className="flex items-center justify-between mb-3">
        <p
          ref={headingRef}
          tabIndex={-1}
          className="text-label text-muted-foreground tracking-wider uppercase"
        >
          {entries.length} item{entries.length === 1 ? "" : "s"}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            await clearHistory();
            refocus.current = true;
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
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    <Select
                      aria-label={`Open ${e.filename} in a tool`}
                      value=""
                      className="h-8 w-auto text-label"
                      onChange={(ev) => ev.target.value && void openIn(e, ev.target.value)}
                    >
                      <option value="">Open in…</option>
                      {OPENERS.map((t) => (
                        <option key={t.slug} value={t.slug}>
                          {t.name}
                        </option>
                      ))}
                    </Select>
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
                        refocus.current = true;
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
