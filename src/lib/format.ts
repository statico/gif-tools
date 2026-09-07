/**
 * Pick the output extension for a tool that preserves its input's format.
 * Odd video containers fall back to mp4; anything unrecognised falls back to
 * gif, which every tool here can produce.
 */
export function outExt(name: string): string {
  const e = name.split(".").pop()?.toLowerCase() ?? "";
  if (e === "jpeg") return "jpg";
  if (["gif", "png", "jpg", "webp", "bmp", "mp4", "webm"].includes(e)) return e;
  if (["mov", "avi", "mkv", "m4v"].includes(e)) return "mp4";
  return "gif";
}
