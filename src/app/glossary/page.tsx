import type { Metadata } from "next";
import Link from "next/link";
import { SITE } from "@/lib/site";
import { TOOLS } from "@/lib/tools";

export const metadata: Metadata = {
  title: "GIF glossary",
  description:
    "Plain definitions of the terms these tools use: palette, dithering, frame delay, lossy compression, APNG, WebP, colour quantisation and Slack emoji limits.",
  alternates: { canonical: `${SITE.url}/glossary/` },
};

const TERMS: { term: string; body: string; see?: string }[] = [
  {
    term: "Palette",
    body: "A GIF stores at most 256 colours per frame, listed in a palette. Fewer colours means a smaller file and flatter-looking gradients. Tools here build the palette from the whole animation first, then map every frame onto it, which avoids the colour flicker you get from per-frame palettes.",
    see: "optimize",
  },
  {
    term: "Dithering",
    body: "Scattering pixels of two palette colours to fake a third. It hides banding in gradients at the cost of a noisier image and a larger file. Turn it off for flat graphics and screenshots, keep it for photos and video.",
    see: "video-to-gif",
  },
  {
    term: "Frame delay",
    body: "How long a frame stays on screen, stored in hundredths of a second. Most browsers clamp anything under 2 (20ms) up to 10, so a GIF authored at 100fps plays at 10fps. Speed changes here rewrite delays rather than dropping frames where they can.",
    see: "speed",
  },
  {
    term: "Lossy compression",
    body: "Throwing away detail a viewer is unlikely to notice, so the file gets smaller. Gifsicle's lossy mode allows nearby pixels to snap to a shared colour; JPEG and WebP quality settings do the same thing for still images.",
    see: "compress",
  },
  {
    term: "Colour quantisation",
    body: "Reducing an image's full colour range down to the palette size. The tools here quantise the whole animation at once so colours stay stable between frames.",
    see: "convert",
  },
  {
    term: "APNG",
    body: "Animated PNG. Full 24-bit colour and real alpha transparency, unlike GIF's single transparent colour, and supported by every current browser. Slack does not accept it for custom emoji, so use GIF there.",
    see: "convert",
  },
  {
    term: "Animated WebP",
    body: "A modern animation format, typically half the size of the same GIF. Good for the web, not accepted by Slack for custom emoji.",
    see: "convert",
  },
  {
    term: "Transparency",
    body: "GIF transparency is binary: a pixel is either fully transparent or fully opaque, which is why soft edges look jagged. The emoji generators account for this by keeping edges hard.",
    see: "text-emoji",
  },
  {
    term: "Slack emoji limits",
    body: "Custom emoji must be under 128KB, are displayed at roughly 22px square, and their names may contain only lowercase letters, numbers, hyphens and underscores. Every download here is named to fit that rule.",
    see: "text-emoji",
  },
  {
    term: "WebAssembly (wasm)",
    body: "Compiled code that runs inside the browser at near-native speed. ffmpeg, gifsicle and ImageMagick are all compiled to WebAssembly here, which is why nothing is uploaded to a server.",
  },
];

export default function Page() {
  return (
    <>
      <h1 className="text-heading text-foreground tracking-tight mb-1.5">GIF glossary</h1>
      <p className="text-sm text-muted-foreground max-w-3xl mb-6">
        The terms these tools use, defined once. Every setting on every page means one of
        these things.
      </p>
      <dl className="max-w-3xl space-y-5">
        {TERMS.map((t) => (
          <div key={t.term} className="border-l-2 border-border pl-4">
            <dt className="text-label text-foreground tracking-wider uppercase mb-1">
              {t.term}
            </dt>
            <dd className="text-sm text-muted-foreground">
              {t.body}
              {t.see ? (
                <>
                  {" "}
                  <Link
                    href={`/${t.see}/`}
                    className="text-primary underline underline-offset-2"
                  >
                    {TOOLS.find((x) => x.slug === t.see)?.name}
                  </Link>
                </>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>
    </>
  );
}
