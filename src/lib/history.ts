"use client";

/**
 * Per-browser history of everything you've made.
 *
 * The index lives in localStorage (small, synchronous, easy to inspect); the
 * actual output blobs live in IndexedDB, because a handful of GIFs blows
 * straight through localStorage's ~5MB quota.
 */
const INDEX_KEY = "gif.statico.io/history/v1";
const DB_NAME = "gif-statico-history";
const STORE = "blobs";
const MAX_ENTRIES = 60;

export interface HistoryEntry {
  id: string;
  tool: string;
  toolName: string;
  filename: string;
  mime: string;
  size: number;
  createdAt: number;
  /** Small data URL for the list view. */
  thumbnail?: string;
  /** Human-readable summary of the settings used. */
  note?: string;
}

function canUse() {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        t.oncomplete = () => db.close();
      }),
  );
}

export function readIndex(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as HistoryEntry[]) : [];
  } catch {
    // Corrupt or quota-blocked storage shouldn't take the page down.
    return [];
  }
}

function writeIndex(entries: HistoryEntry[]) {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(entries));
  } catch {
    /* private mode / quota: history is a convenience, not a requirement */
  }
}

/** Render a small JPEG thumbnail so the history list stays cheap. */
async function makeThumbnail(blob: Blob, mime: string): Promise<string | undefined> {
  if (!mime.startsWith("image/")) return undefined;
  try {
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(96 / bitmap.width, 96 / bitmap.height, 1);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return canvas.toDataURL("image/jpeg", 0.6);
  } catch {
    return undefined;
  }
}

/**
 * The index is a read-modify-write over one localStorage key, and callers fire
 * this without awaiting it, so two overlapping saves would both read the old
 * index and the second write would drop the first record — leaving its blob in
 * IndexedDB with nothing pointing at it. One chain, one writer at a time.
 */
let writes: Promise<unknown> = Promise.resolve();

export function addToHistory(
  entry: Omit<HistoryEntry, "id" | "createdAt" | "size" | "thumbnail">,
  data: Uint8Array | Blob,
): Promise<HistoryEntry | null> {
  const next = writes.then(
    () => save(entry, data),
    () => save(entry, data),
  );
  writes = next.catch(() => {});
  return next;
}

async function save(
  entry: Omit<HistoryEntry, "id" | "createdAt" | "size" | "thumbnail">,
  data: Uint8Array | Blob,
): Promise<HistoryEntry | null> {
  if (!canUse()) return null;
  const blob =
    data instanceof Blob
      ? data
      : new Blob([data.slice().buffer as ArrayBuffer], { type: entry.mime });

  const record: HistoryEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
    size: blob.size,
    thumbnail: await makeThumbnail(blob, entry.mime),
  };

  try {
    await tx("readwrite", (s) => s.put(blob, record.id));
  } catch {
    return null;
  }

  const next = [record, ...readIndex()];
  // Trim the tail, and drop the matching blobs so IndexedDB doesn't grow forever.
  const evicted = next.slice(MAX_ENTRIES);
  await Promise.all(
    evicted.map((e) => tx("readwrite", (s) => s.delete(e.id)).catch(() => undefined)),
  );
  writeIndex(next.slice(0, MAX_ENTRIES));
  window.dispatchEvent(new CustomEvent("gif-history-change"));
  return record;
}

/**
 * Files that a URL can point back at. Picking a file (or handing one to the
 * next tool) stashes it under an id and puts `#s=<id>` in the URL, so the
 * back button lands on the previous tool with its file still loaded. Same
 * store, reserved prefix; only the newest few are kept.
 */
const SOURCE_PREFIX = "src:";
const MAX_SOURCES = 20;

export async function stashSource(blob: Blob, name: string): Promise<string | null> {
  if (!canUse()) return null;
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  try {
    await tx("readwrite", (s) => s.put({ blob, name }, SOURCE_PREFIX + id));
    const keys = (await tx<IDBValidKey[]>("readonly", (s) => s.getAllKeys())).filter(
      (k): k is string => typeof k === "string" && k.startsWith(SOURCE_PREFIX),
    );
    // Ids are time-ordered, so sorting the keys sorts by age.
    const old = keys.sort().slice(0, Math.max(0, keys.length - MAX_SOURCES));
    await Promise.all(old.map((k) => tx("readwrite", (s) => s.delete(k)).catch(() => undefined)));
    return id;
  } catch {
    return null;
  }
}

export async function loadSource(id: string): Promise<File | null> {
  if (!canUse()) return null;
  try {
    const rec = await tx<{ blob: Blob; name: string } | undefined>("readonly", (s) =>
      s.get(SOURCE_PREFIX + id),
    );
    return rec ? new File([rec.blob], rec.name, { type: rec.blob.type }) : null;
  } catch {
    return null;
  }
}

/** Where a tool page lives when opened with this stashed file. */
export const sourceHref = (slug: string, id: string | null) => `/${slug}/${id ? `#s=${id}` : ""}`;

export const sourceIdFromHash = (hash: string) => /^#s=([a-z0-9]+)$/.exec(hash)?.[1] ?? null;

export async function getBlob(id: string): Promise<Blob | null> {
  if (!canUse()) return null;
  try {
    return (await tx<Blob | undefined>("readonly", (s) => s.get(id))) ?? null;
  } catch {
    return null;
  }
}

export async function removeFromHistory(id: string): Promise<void> {
  writeIndex(readIndex().filter((e) => e.id !== id));
  await tx("readwrite", (s) => s.delete(id)).catch(() => undefined);
  window.dispatchEvent(new CustomEvent("gif-history-change"));
}

export async function clearHistory(): Promise<void> {
  writeIndex([]);
  await tx("readwrite", (s) => s.clear()).catch(() => undefined);
  window.dispatchEvent(new CustomEvent("gif-history-change"));
}
