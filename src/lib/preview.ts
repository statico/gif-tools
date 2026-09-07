"use client";

import * as React from "react";

/**
 * The first frame of a file, ready to draw on a canvas, so tools can show what
 * a setting does without paying for a full wasm encode.
 *
 * ponytail: first frame only. Animated previews would mean decoding every
 * frame in JS, which is the encode we are trying to avoid; the still is enough
 * to judge a crop, a rotation or a colour effect.
 */
export function useFirstFrame(file: File | null) {
  const [frame, setFrame] = React.useState<CanvasImageSource | null>(null);
  const [size, setSize] = React.useState<{ w: number; h: number } | null>(null);

  React.useEffect(() => {
    setFrame(null);
    setSize(null);
    if (!file) return;

    let live = true;
    const url = URL.createObjectURL(file);
    const done = (src: CanvasImageSource, w: number, h: number) => {
      if (!live) return;
      setFrame(src);
      setSize({ w, h });
    };

    if (file.type.startsWith("video/")) {
      const v = document.createElement("video");
      v.muted = true;
      v.preload = "auto";
      // Seek a hair past zero: frame 0 of an encoded video is often black.
      v.onloadeddata = () => {
        v.currentTime = Math.min(0.1, (v.duration || 1) / 10);
      };
      v.onseeked = () => done(v, v.videoWidth, v.videoHeight);
      v.src = url;
    } else {
      const img = new Image();
      img.onload = () => done(img, img.naturalWidth, img.naturalHeight);
      img.src = url;
    }

    return () => {
      live = false;
      URL.revokeObjectURL(url);
    };
  }, [file]);

  return { frame, size };
}
