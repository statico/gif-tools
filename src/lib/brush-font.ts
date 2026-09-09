"use client";
import * as React from "react";

export const SANS = 'Impact, "Arial Black", "Helvetica Neue", Arial, sans-serif';
// Apple's 💯 is hand-drawn artwork, not type; Permanent Marker (Apache 2.0) is
// the closest open face: a fat, confident marker that still reads at 22px.
export const BRUSH = '"Permanent Marker", ' + SANS;

/** Loads the brush face on demand; true once it can be drawn (or gave up). */
export function useBrushFont() {
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => {
    const face = new FontFace("Permanent Marker", "url(/fonts/permanent-marker.ttf)");
    face
      .load()
      .then((f) => document.fonts.add(f))
      .catch(() => undefined) // falls back to the heavy sans
      .finally(() => setReady(true));
  }, []);
  return ready;
}
