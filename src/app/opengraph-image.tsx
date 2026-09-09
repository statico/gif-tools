import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { SITE } from "@/lib/site";
import { TOOLS } from "@/lib/tools";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
// Required by output: "export" — the image is baked once at build time.
export const dynamic = "force-static";
export const alt = SITE.title;

// Rendered once at build time and emitted as a static PNG by the export.
export default async function OpengraphImage() {
  // VCR OSD Mono, freeware by Riciery Leal. Read from disk at build time.
  const vcr = await readFile(new URL("./vcr-osd-mono.ttf", import.meta.url));
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#1a1e24",
        color: "#d8dee9",
        fontFamily: "VCR OSD Mono",
        padding: 64,
        borderTop: "12px solid #88c0d0",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          style={{ fontSize: 26, letterSpacing: 6, color: "#8e99a8", textTransform: "uppercase" }}
        >
          gif toolkit
        </div>
        <div style={{ fontSize: 82, lineHeight: 1.05, marginTop: 18, color: "#eceff4" }}>
          Every GIF tool,
        </div>
        <div style={{ fontSize: 82, lineHeight: 1.05, color: "#88c0d0" }}>in your browser.</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 27, color: "#8e99a8" }}>
          {`${TOOLS.length} tools · ffmpeg + gifsicle + ImageMagick in WebAssembly · nothing uploaded`}
        </div>
        <div style={{ fontSize: 34, color: "#eceff4", letterSpacing: 2 }}>{SITE.name}</div>
      </div>
    </div>,
    { ...size, fonts: [{ name: "VCR OSD Mono", data: vcr, weight: 400, style: "normal" }] },
  );
}
