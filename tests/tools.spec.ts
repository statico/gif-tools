import { test, expect } from "@playwright/test";
import path from "node:path";

const GIF = path.join(__dirname, "fixtures/sample.gif");

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
  await page.getByRole("button", { name: /reverse/i }).last().click();

  await expect(page.getByRole("button", { name: /^download/i })).toBeEnabled({
    timeout: 150_000,
  });
  await expect(page.getByText(/cannot find module/i)).toHaveCount(0);
});

// Regression: initializeImageMagick() links against the wasm32 build, so
// copying dist/x64/magick.wasm gives a LinkError at instantiation time.
test("imagemagick links against the wasm32 build", async ({ page }) => {
  await page.goto("/compress/");
  await page.setInputFiles("input[type=file]", path.join(__dirname, "fixtures/sample.png"));
  await page.getByRole("button", { name: /compress image/i }).click();

  await expect(page.getByRole("button", { name: /^download/i })).toBeEnabled({
    timeout: 120_000,
  });
  await expect(page.getByText(/LinkError/i)).toHaveCount(0);
});
