"use client";

export function download(data: Uint8Array | Blob, filename: string, mime?: string) {
  const blob =
    data instanceof Blob
      ? data
      : new Blob([data.slice().buffer as ArrayBuffer], {
          type: mime ?? "application/octet-stream",
        });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const MIME: Record<string, string> = {
  gif: "image/gif",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  apng: "image/apng",
  bmp: "image/bmp",
  mp4: "video/mp4",
  webm: "video/webm",
  zip: "application/zip",
};

export function mimeFor(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return MIME[ext] ?? "application/octet-stream";
}
