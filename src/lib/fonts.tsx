"use client";
import * as React from "react";

const SANS = 'Impact, "Arial Black", "Helvetica Neue", Arial, sans-serif';

/**
 * Faces the canvas tools can set type in. Apple's 💯 is hand-drawn artwork,
 * not type, so the brush faces are the closest open-licensed matches; each
 * loads on first use from /fonts. All OFL or Apache 2.0.
 */
export const FACES = {
  impact: { label: "Impact — heavy sans", family: SANS, file: null },
  caveat: {
    label: "Caveat Brush — loose brush",
    family: `"Caveat Brush", ${SANS}`,
    file: "caveat-brush",
  },
  luckiest: {
    label: "Luckiest Guy — bold cartoon brush",
    family: `"Luckiest Guy", ${SANS}`,
    file: "luckiest-guy",
  },
  chewy: { label: "Chewy — rounded marker", family: `"Chewy", ${SANS}`, file: "chewy" },
  marker: {
    label: "Permanent Marker — fat marker",
    family: `"Permanent Marker", ${SANS}`,
    file: "permanent-marker",
  },
} as const;
export type FaceId = keyof typeof FACES;
export const FACE_IDS = Object.keys(FACES) as FaceId[];

const loaded = new Map<FaceId, Promise<void>>();

/** True once `id` can be drawn (or loading gave up and the sans will stand in). */
export function useFace(id: FaceId) {
  const [ready, setReady] = React.useState(() => !FACES[id].file);
  React.useEffect(() => {
    const { family, file } = FACES[id];
    if (!file) return setReady(true);
    let p = loaded.get(id);
    if (!p) {
      p = new FontFace(family.split(",")[0].replace(/"/g, ""), `url(/fonts/${file}.ttf)`)
        .load()
        .then((f) => void document.fonts.add(f))
        .catch(() => undefined);
      loaded.set(id, p);
    }
    setReady(false);
    let live = true;
    void p.finally(() => live && setReady(true));
    return () => void (live = false);
  }, [id]);
  return ready;
}

/** Select options, with the tool's default marked. */
export function faceOptions(def: FaceId) {
  return FACE_IDS.map((id) => (
    <option key={id} value={id}>
      {FACES[id].label}
      {id === def ? " (default)" : ""}
    </option>
  ));
}
