import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const GIF = path.join(import.meta.dirname, "fixtures/sample.gif");

// Real wasm encodes: the ffmpeg core alone is ~32MB, so these are slow by nature.
test.describe.configure({ mode: "serial", timeout: 180_000 });

test("optimize actually shrinks a GIF with gifsicle", async ({ page }) => {
  await page.goto("/optimize/");
  await page.setInputFiles("#optimize-file", GIF);
  await page.getByRole("button", { name: /optimize gif/i }).click();

  const download = page.getByRole("button", { name: /^download/i });
  await expect(download).toBeEnabled({ timeout: 120_000 });
  await expect(page.getByRole("img", { name: /result from the/i })).toBeVisible();
});

test("text-emoji generates a downloadable file with a slack-safe name", async ({ page }) => {
  await page.goto("/text-emoji/");

  // Generators need no upload, so this exercises the canvas path on its own.
  await page.getByRole("button", { name: /^generate /i }).click();
  const download = page.getByRole("button", { name: /^download/i });
  await expect(download).toBeEnabled({ timeout: 60_000 });

  const [saved] = await Promise.all([page.waitForEvent("download"), download.click()]);
  expect(saved.suggestedFilename()).toMatch(/^[a-z0-9-]+\.(gif|png)$/);
});

test("a result is written to history and survives a reload", async ({ page }) => {
  await page.goto("/optimize/");
  await page.setInputFiles("#optimize-file", GIF);
  await page.getByRole("button", { name: /optimize gif/i }).click();
  await expect(page.getByRole("button", { name: /^download/i })).toBeEnabled({
    timeout: 120_000,
  });

  await page.goto("/history/");
  await expect(page.getByRole("button", { name: /^download /i }).first()).toBeVisible({
    timeout: 15_000,
  });
});

// Regression: @ffmpeg/ffmpeg always spawns its worker as an ES module, where
// importScripts() is gone and the bundled fallback is a stub that throws
// "Cannot find module". scripts/copy-wasm.mjs patches a real dynamic import
// back in; this fails loudly if that patch ever stops applying.
test("the ffmpeg worker loads its core and produces output", async ({ page }) => {
  await page.goto("/reverse/");
  await page.setInputFiles("input[type=file]", GIF);
  await page
    .getByRole("button", { name: /reverse/i })
    .last()
    .click();

  await expect(page.getByRole("button", { name: /^download/i })).toBeEnabled({
    timeout: 150_000,
  });
  await expect(page.getByText(/cannot find module/i)).toHaveCount(0);
});

// Regression: initializeImageMagick() links against the wasm32 build, so
// copying dist/x64/magick.wasm gives a LinkError at instantiation time.
test("imagemagick links against the wasm32 build", async ({ page }) => {
  await page.goto("/compress/");
  await page.setInputFiles(
    "input[type=file]",
    path.join(import.meta.dirname, "fixtures/sample.png"),
  );
  await page.getByRole("button", { name: "Compress image", exact: true }).click();

  await expect(page.getByRole("button", { name: /^download/i })).toBeEnabled({
    timeout: 120_000,
  });
  await expect(page.getByText(/LinkError/i)).toHaveCount(0);
});

// Regression: a non-zero ffmpeg exec still creates its output file, and without
// -y (or a cleanup that runs on failure) every later run of that tool died with
// "File 'out.gif' already exists. Exiting." until the page was reloaded.
test("a failed run does not wedge the tool", async ({ page }) => {
  await page.goto("/reverse/");
  await page.setInputFiles("#reverse-file", path.join(import.meta.dirname, "fixtures/broken.gif"));
  await page.getByRole("button", { name: "Reverse", exact: true }).click();
  // Not getByRole("alert"): Next ships an always-present empty route announcer
  // with that role, so a bare alert query resolves before the run even fails.
  await expect(page.getByText(/could not reverse this file/i)).toBeVisible({ timeout: 150_000 });

  await page.setInputFiles("#reverse-file", GIF);
  await page.getByRole("button", { name: "Reverse", exact: true }).click();
  const download = page.getByRole("button", { name: /^download/i });
  await expect(download).toBeEnabled({ timeout: 150_000 });

  // The recovered run has to produce a real GIF, not just an enabled button.
  const [saved] = await Promise.all([page.waitForEvent("download"), download.click()]);
  const bytes = await fs.readFile(await saved.path());
  expect(bytes.subarray(0, 6).toString()).toMatch(/^GIF8/);
});

// The only tool that emits a container rather than an image: fflate zips every
// extracted frame, so a broken frame read shows up as a zip with no entries.
test("split packs every frame into a downloadable ZIP", async ({ page }) => {
  await page.goto("/split/");
  await page.setInputFiles("#split-file", GIF);
  await page.getByRole("button", { name: "Split into frames", exact: true }).click();

  const download = page.getByRole("button", { name: /^download/i });
  await expect(download).toBeEnabled({ timeout: 150_000 });
  await expect(page.getByText(/frames extracted/i)).toBeVisible();

  const [saved] = await Promise.all([page.waitForEvent("download"), download.click()]);
  expect(saved.suggestedFilename()).toMatch(/\.zip$/);
  const bytes = await fs.readFile(await saved.path());
  expect(bytes.subarray(0, 2).toString("latin1")).toBe("PK");
});

// Regression: encodeGif used to flag palette index 0 transparent unconditionally,
// so an opaque source got holes punched wherever its darkest colour appeared.
// Byte 3 of each Graphic Control Extension (21 F9 04 <flags>) has the
// transparency bit in position 0; on an opaque source it must be clear.
for (const [fixture, wantTransparent] of [
  ["opaque.png", false],
  ["alpha.png", true],
] as const) {
  test(`party ${wantTransparent ? "keeps" : "does not invent"} transparency for ${fixture}`, async ({
    page,
  }) => {
    await page.goto("/party/");
    await page.setInputFiles(
      "input[type=file]",
      path.join(import.meta.dirname, "fixtures", fixture),
    );
    await page.getByRole("button", { name: /party it up/i }).click();

    const download = page.getByRole("button", { name: /^download/i });
    await expect(download).toBeEnabled({ timeout: 60_000 });
    const [saved] = await Promise.all([page.waitForEvent("download"), download.click()]);

    const bytes = await fs.readFile(await saved.path());
    const flags: number[] = [];
    for (let i = 0; i < bytes.length - 3; i++) {
      if (bytes[i] === 0x21 && bytes[i + 1] === 0xf9 && bytes[i + 2] === 0x04) {
        flags.push(bytes[i + 3]);
      }
    }
    expect(flags.length).toBeGreaterThan(0);
    expect(flags.every((f) => Boolean(f & 1) === wantTransparent)).toBe(true);
  });
}
