"use client";

import { GIFEncoder, quantize, applyPalette } from "gifenc";

/**
 * Encode canvas frames to an animated GIF. Used by every generator tool
 * (intensify, party, emojify, number, text) — ffmpeg is overkill when we
 * already have pixels in hand.
 */
export interface EncodeOptions {
  /** Per-frame delay in ms. A number applies to every frame. */
  delayMs: number | number[];
  /** 2-256. Fewer colours means a much smaller file. */
  maxColors?: number;
  /** 0 = loop forever. */
  loop?: number;
  /** Treat fully-transparent pixels as transparent in the GIF. */
  transparent?: boolean;
}

export function encodeGif(
  frames: ImageData[],
  { delayMs, maxColors = 256, loop = 0, transparent = true }: EncodeOptions,
): Uint8Array {
  if (!frames.length) throw new Error("encodeGif needs at least one frame");
  const gif = GIFEncoder();
  const { width, height } = frames[0];

  frames.forEach((frame, i) => {
    const delay = Array.isArray(delayMs) ? delayMs[i] ?? delayMs[0] : delayMs;
    // rgb565 keeps the palette small and is plenty for flat emoji art.
    const format = transparent ? "rgba4444" : "rgb565";
    const palette = quantize(frame.data, maxColors, { format });
    const index = applyPalette(frame.data, palette, format);
    // quantize only emits an alpha-0 entry when the frame actually has one, and
    // it is not necessarily index 0. Flagging index 0 blindly punches holes in an
    // opaque image wherever its darkest colour appears.
    const ti = transparent ? palette.findIndex((c) => c[3] === 0) : -1;
    gif.writeFrame(index, width, height, {
      palette,
      delay,
      transparent: ti >= 0,
      transparentIndex: ti >= 0 ? ti : undefined,
      dispose: ti >= 0 ? 2 : -1,
      repeat: i === 0 ? loop : undefined,
    });
  });

  gif.finish();
  return gif.bytes();
}

/** Render `count` frames by calling `draw` with a 0..1 progress value. */
export function renderFrames(
  size: { width: number; height: number },
  count: number,
  draw: (ctx: CanvasRenderingContext2D, t: number, i: number) => void,
): ImageData[] {
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("could not get a 2D canvas context");

  const frames: ImageData[] = [];
  for (let i = 0; i < count; i++) {
    ctx.clearRect(0, 0, size.width, size.height);
    draw(ctx, i / count, i);
    frames.push(ctx.getImageData(0, 0, size.width, size.height));
  }
  return frames;
}

/** Load a File/Blob into an ImageBitmap-ish drawable, honouring EXIF-free sizing. */
export async function loadImage(src: Blob | File | string): Promise<HTMLImageElement> {
  const url = typeof src === "string" ? src : URL.createObjectURL(src);
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("could not decode that image"));
      img.src = url;
    });
    return img;
  } finally {
    if (typeof src !== "string") {
      // Revoke after decode; the element keeps its own copy of the pixels.
      setTimeout(() => URL.revokeObjectURL(url), 0);
    }
  }
}
