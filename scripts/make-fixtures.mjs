// Build the test fixtures: a small animated GIF and a still PNG.
import { writeFile, mkdir } from "node:fs/promises";
import gifenc from "gifenc";
const { GIFEncoder, quantize, applyPalette } = gifenc;

const W = 64,
  H = 64,
  FRAMES = 6;
const gif = GIFEncoder();

for (let f = 0; f < FRAMES; f++) {
  const data = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      // A moving diagonal band, so frames actually differ and reversing shows.
      const band = (x + y + f * 8) % 64 < 32;
      data[i] = band ? 220 : 40;
      data[i + 1] = band ? 90 : 60;
      data[i + 2] = band ? 60 : 200;
      data[i + 3] = 255;
    }
  }
  const palette = quantize(data, 64, { format: "rgb565" });
  gif.writeFrame(applyPalette(data, palette, "rgb565"), W, H, {
    palette,
    delay: 80,
    repeat: f === 0 ? 0 : undefined,
  });
}
gif.finish();

await mkdir("tests/fixtures", { recursive: true });
await writeFile("tests/fixtures/sample.gif", gif.bytes());
console.log("wrote tests/fixtures/sample.gif", gif.bytes().length, "bytes");

// A 1x1-ish PNG is useless for resizing, so emit a real 64x64 PNG by hand.
const { deflateSync } = await import("node:zlib");
const raw = Buffer.alloc((W * 3 + 1) * H);
let o = 0;
for (let y = 0; y < H; y++) {
  raw[o++] = 0;
  for (let x = 0; x < W; x++) {
    raw[o++] = (x * 4) & 255;
    raw[o++] = (y * 4) & 255;
    raw[o++] = 128;
  }
}
const chunk = (type, body) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(body.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), body]);
  const crcTable = [...Array(256)].map((_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  let crc = 0xffffffff;
  for (const b of td) crc = crcTable[(crc ^ b) & 255] ^ (crc >>> 8);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([len, td, crcBuf]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8;
ihdr[9] = 2;
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw)),
  chunk("IEND", Buffer.alloc(0)),
]);
await writeFile("tests/fixtures/sample.png", png);
console.log("wrote tests/fixtures/sample.png", png.length, "bytes");
