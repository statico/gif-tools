"use client";
import * as React from "react";

export const SANS = 'Impact, "Arial Black", "Helvetica Neue", Arial, sans-serif';
// Apple's 💯 is hand-drawn artwork, not type; Knewave (OFL) is
// the closest open face: a fat, confident marker that still reads at 22px.
export const BRUSH = '"Knewave", ' + SANS;

/** Loads the brush face on demand; true once it can be drawn (or gave up). */
export function useBrushFont() {
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => {
    const face = new FontFace("Knewave", "url(/fonts/knewave.ttf)");
    face
      .load()
      .then((f) => document.fonts.add(f))
      .catch(() => undefined) // falls back to the heavy sans
      .finally(() => setReady(true));
  }, []);
  return ready;
}
