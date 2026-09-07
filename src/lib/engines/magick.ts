"use client";

import {
  ImageMagick,
  initializeImageMagick,
  MagickFormat,
  type IMagickImage,
} from "@imagemagick/magick-wasm";

let ready: Promise<void> | null = null;

async function init() {
  if (!ready) {
    ready = (async () => {
      const wasm = await fetch("/magick/magick.wasm");
      if (!wasm.ok) throw new Error(`could not load magick.wasm (${wasm.status})`);
      await initializeImageMagick(new Uint8Array(await wasm.arrayBuffer()));
    })();
    ready.catch(() => {
      ready = null;
    });
  }
  return ready;
}

export { MagickFormat };

/**
 * Read an image with ImageMagick and hand it to `fn`, which mutates it in
 * place. Returns the encoded bytes in `format`.
 */
export async function withMagick(
  file: Blob | File | Uint8Array,
  format: MagickFormat,
  fn: (img: IMagickImage) => void,
): Promise<Uint8Array> {
  await init();
  const bytes = file instanceof Uint8Array ? file : new Uint8Array(await file.arrayBuffer());
  return new Promise((resolve, reject) => {
    try {
      ImageMagick.read(bytes, (img) => {
        fn(img);
        img.write(format, (data) => resolve(new Uint8Array(data)));
      });
    } catch (err) {
      reject(err);
    }
  });
}

/** Re-encode a still image at a given quality, optionally stripping metadata. */
export async function compressImage(
  file: Blob | File,
  {
    format,
    quality = 82,
    strip = true,
  }: { format: MagickFormat; quality?: number; strip?: boolean },
): Promise<Uint8Array> {
  return withMagick(file, format, (img) => {
    img.quality = Math.min(Math.max(Math.round(quality), 1), 100);
    if (strip) img.strip();
  });
}
