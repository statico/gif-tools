/**
 * Single source of truth for every tool. Drives the nav, the home grid,
 * per-page SEO metadata, sitemap.xml, llms.txt and the .md mirrors.
 */
export type ToolCategory = "convert" | "edit" | "optimize" | "emoji";

export interface Tool {
  slug: string;
  name: string;
  /** <title> and og:title use this. */
  title: string;
  /** meta description + llms.txt line. Aim for 120-160 chars. */
  description: string;
  /** Short label for cards/nav. */
  blurb: string;
  category: ToolCategory;
  engine: ("ffmpeg" | "gifsicle" | "magick" | "canvas")[];
  keywords: string[];
}

export const CATEGORIES: Record<ToolCategory, { label: string; description: string }> = {
  convert: { label: "convert", description: "Move between video, GIF, WebP, APNG and still images." },
  edit: { label: "edit", description: "Resize, crop, trim, rotate, caption and apply effects." },
  optimize: { label: "optimize", description: "Shrink files without wrecking them." },
  emoji: { label: "emoji", description: "Slack-ready animated emoji and text generators." },
};

export const TOOLS: Tool[] = [
  {
    slug: "video-to-gif",
    name: "Video to GIF",
    title: "Video to GIF converter",
    description:
      "Convert MP4, WebM, MOV or AVI video to an animated GIF in your browser. Pick a time range, frame rate, width and palette quality. No upload, no watermark.",
    blurb: "MP4/WebM/MOV → animated GIF with palette tuning.",
    category: "convert",
    engine: ["ffmpeg"],
    keywords: ["video to gif", "mp4 to gif", "webm to gif", "mov to gif"],
  },
  {
    slug: "gif-to-video",
    name: "GIF to Video",
    title: "GIF to MP4 / WebM converter",
    description:
      "Turn an animated GIF into an MP4 or WebM video that plays anywhere and weighs a fraction of the GIF. Runs locally with ffmpeg compiled to WebAssembly.",
    blurb: "GIF → MP4/WebM, far smaller than the original.",
    category: "convert",
    engine: ["ffmpeg"],
    keywords: ["gif to mp4", "gif to video", "gif to webm"],
  },
  {
    slug: "gif-maker",
    name: "GIF Maker",
    title: "GIF maker — build a GIF from images",
    description:
      "Build an animated GIF from a set of images. Reorder frames, set per-frame delay, choose loop count and preview the result before you download it.",
    blurb: "Images → GIF. Reorder frames, set delay and looping.",
    category: "convert",
    engine: ["canvas", "ffmpeg"],
    keywords: ["gif maker", "images to gif", "png to gif", "animated gif creator"],
  },
  {
    slug: "convert",
    name: "Convert",
    title: "Image and animation format converter",
    description:
      "Convert between GIF, PNG, JPEG, WebP, animated WebP, APNG and BMP, keeping animation wherever the target format supports it. ImageMagick and ffmpeg in wasm.",
    blurb: "GIF ⇄ PNG/JPEG/WebP/APNG/BMP, animation preserved.",
    category: "convert",
    engine: ["magick", "ffmpeg"],
    keywords: ["gif to webp", "webp to gif", "apng", "image converter"],
  },
  {
    slug: "split",
    name: "Split",
    title: "GIF splitter — export every frame",
    description:
      "Split an animated GIF or WebP into its individual frames and download them as PNGs in a ZIP, or grab a single frame. Shows the delay of each frame.",
    blurb: "GIF → individual frames as PNG, zipped.",
    category: "convert",
    engine: ["ffmpeg"],
    keywords: ["gif splitter", "gif to png", "extract gif frames"],
  },
  {
    slug: "resize",
    name: "Resize",
    title: "Resize a GIF, image or video",
    description:
      "Resize an animated GIF, still image or video by pixels or percentage. Lock the aspect ratio or stretch to fit, with Lanczos scaling for clean edges.",
    blurb: "Scale by pixels or percent, aspect lock optional.",
    category: "edit",
    engine: ["ffmpeg", "gifsicle"],
    keywords: ["resize gif", "gif resizer", "scale gif"],
  },
  {
    slug: "crop",
    name: "Crop",
    title: "Crop a GIF or image",
    description:
      "Crop an animated GIF, image or video with a draggable selection box, exact pixel entry or a fixed aspect ratio preset. Animation survives the crop.",
    blurb: "Drag a box or type exact pixels. Keeps animation.",
    category: "edit",
    engine: ["ffmpeg"],
    keywords: ["crop gif", "gif cropper", "square crop"],
  },
  {
    slug: "cut",
    name: "Cut",
    title: "Cut and trim a GIF or video",
    description:
      "Trim an animated GIF or video down to the part you actually want. Scrub to a start and end point, preview the selection and export just that range.",
    blurb: "Trim to a start/end range with a scrubber.",
    category: "edit",
    engine: ["ffmpeg"],
    keywords: ["cut gif", "trim gif", "shorten gif"],
  },
  {
    slug: "speed",
    name: "Speed",
    title: "Change GIF speed",
    description:
      "Speed up or slow down an animated GIF or video. Use a multiplier or target a specific frame rate, and optionally drop frames to keep the file small.",
    blurb: "Faster or slower, by multiplier or target FPS.",
    category: "edit",
    engine: ["ffmpeg"],
    keywords: ["gif speed", "speed up gif", "slow down gif"],
  },
  {
    slug: "reverse",
    name: "Reverse",
    title: "Reverse a GIF",
    description:
      "Play an animated GIF backwards, or make a seamless boomerang that runs forward then back. Works on video input too.",
    blurb: "Backwards, or a seamless boomerang loop.",
    category: "edit",
    engine: ["ffmpeg"],
    keywords: ["reverse gif", "boomerang gif", "backwards gif"],
  },
  {
    slug: "rotate",
    name: "Rotate",
    title: "Rotate and flip a GIF",
    description:
      "Rotate an animated GIF or image by 90, 180 or 270 degrees, flip it horizontally or vertically, or rotate by an arbitrary angle with a chosen background colour.",
    blurb: "90/180/270, arbitrary angles, and mirror flips.",
    category: "edit",
    engine: ["ffmpeg"],
    keywords: ["rotate gif", "flip gif", "mirror gif"],
  },
  {
    slug: "add-text",
    name: "Add Text",
    title: "Add text or a caption to a GIF",
    description:
      "Put meme-style captions on an animated GIF. Choose top or bottom placement, a caption bar or overlay, font size, colour and outline. Text stays put across frames.",
    blurb: "Meme captions, overlays and caption bars.",
    category: "edit",
    engine: ["canvas", "ffmpeg"],
    keywords: ["add text to gif", "gif caption", "meme text"],
  },
  {
    slug: "effects",
    name: "Effects",
    title: "GIF effects and filters",
    description:
      "Apply grayscale, sepia, invert, blur, sharpen, posterise and brightness, contrast, saturation or hue adjustments to an animated GIF or image.",
    blurb: "Grayscale, sepia, invert, blur, colour adjustments.",
    category: "edit",
    engine: ["ffmpeg", "magick"],
    keywords: ["gif effects", "gif filter", "grayscale gif"],
  },
  {
    slug: "optimize",
    name: "Optimize",
    title: "GIF optimizer and compressor",
    description:
      "Shrink an animated GIF with gifsicle: lossy compression, colour reduction, frame differencing and optional frame dropping, compared against the original.",
    blurb: "gifsicle lossy compression and colour reduction.",
    category: "optimize",
    engine: ["gifsicle"],
    keywords: ["optimize gif", "compress gif", "gif compressor", "reduce gif size"],
  },
  {
    slug: "compress",
    name: "Compress Image",
    title: "Compress PNG, JPEG and WebP",
    description:
      "Reduce the file size of a still image. Set JPEG or WebP quality, strip metadata, or quantise a PNG's palette, and see the saving before you download.",
    blurb: "Quality control and metadata stripping for stills.",
    category: "optimize",
    engine: ["magick"],
    keywords: ["compress png", "compress jpeg", "image compressor"],
  },
  {
    slug: "intensify",
    name: "Intensifies",
    title: "Intensifies GIF generator",
    description:
      "Make any image shake violently — the classic [INTENSIFIES] Slack emoji. Control shake amount, speed and whether the edges get cropped or padded.",
    blurb: "The classic shaking [INTENSIFIES] emoji.",
    category: "emoji",
    engine: ["canvas"],
    keywords: ["intensifies", "intensifies gif", "shaking emoji", "slack emoji"],
  },
  {
    slug: "party",
    name: "Party",
    title: "Party parrot generator — partyfy any image",
    description:
      "Cycle any image through the party parrot rainbow. Choose the palette, the number of frames and whether the whole image or just its bright areas get recoloured.",
    blurb: "Rainbow colour-cycling, party parrot style.",
    category: "emoji",
    engine: ["canvas"],
    keywords: ["party parrot", "partyfy", "rainbow emoji", "slack emoji"],
  },
  {
    slug: "emojify",
    name: "Emojify",
    title: "Animated Slack emoji effects",
    description:
      "Apply the popular animated emoji effects — spin, bounce, zoom, wiggle, vibrate, rainbow, roll and more — to any image, sized and named for Slack.",
    blurb: "Spin, bounce, zoom, wiggle, rainbow and friends.",
    category: "emoji",
    engine: ["canvas"],
    keywords: ["slack emoji generator", "animated emoji", "spin emoji", "bounce emoji"],
  },
  {
    slug: "number",
    name: "Number",
    title: "100-style number emoji generator",
    description:
      "Generate 100-style number emoji — any number, in the double-underlined red style or your own colours. Export a static PNG or an animated glowing GIF.",
    blurb: "100-style numbers in any value and colour.",
    category: "emoji",
    engine: ["canvas"],
    keywords: ["100 emoji", "number emoji", "hundred emoji generator"],
  },
  {
    slug: "text-emoji",
    name: "Text Emoji",
    title: "Square text emoji generator for Slack",
    description:
      "Turn short phrases like \"yes\", \"nope\" or \"hell yeah\" into square, legible Slack emoji. Auto-wraps onto multiple lines and ships a range of ready-made styles.",
    blurb: "\"hell yeah\" as a square, readable 128px emoji.",
    category: "emoji",
    engine: ["canvas"],
    keywords: ["text emoji generator", "slack text emoji", "square emoji", "word emoji"],
  },
];

export const TOOLS_BY_SLUG: Record<string, Tool> = Object.fromEntries(
  TOOLS.map((t) => [t.slug, t]),
);

export function toolsIn(category: ToolCategory): Tool[] {
  return TOOLS.filter((t) => t.category === category);
}

export function getTool(slug: string): Tool {
  const t = TOOLS_BY_SLUG[slug];
  if (!t) throw new Error(`Unknown tool slug: ${slug}`);
  return t;
}
