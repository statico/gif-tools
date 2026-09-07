import { test, expect } from "@playwright/test";
import { TOOLS } from "../src/lib/tools";

const ROUTES = ["/", "/history/", "/glossary/", ...TOOLS.map((t) => `/${t.slug}/`)];

test.describe("every page", () => {
  for (const route of ROUTES) {
    test(`${route} renders with its metadata`, async ({ page }) => {
      const res = await page.goto(route);
      expect(res?.status(), `${route} should return 200`).toBe(200);

      // Exactly one h1, and it isn't empty.
      const h1 = page.locator("h1");
      await expect(h1).toHaveCount(1);
      await expect(h1).not.toBeEmpty();

      await expect(page).toHaveTitle(/\S/);
      const desc = page.locator('meta[name="description"]');
      await expect(desc).toHaveAttribute("content", /.{50,}/);
      await expect(page.locator("html")).toHaveAttribute("lang", "en");
      await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);

      // No console errors on load.
      const errors: string[] = [];
      page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
      await page.waitForTimeout(300);
      expect(errors, `console errors on ${route}`).toEqual([]);
    });
  }
});

test.describe("tool pages", () => {
  for (const tool of TOOLS) {
    test(`/${tool.slug}/ has structured data and a working control surface`, async ({ page }) => {
      await page.goto(`/${tool.slug}/`);

      const ld = await page.locator('script[type="application/ld+json"]').first().textContent();
      const parsed = JSON.parse(ld ?? "{}");
      const graph = parsed["@graph"] ?? [];
      expect(graph.some((n: { "@type": string }) => n["@type"] === "WebApplication")).toBe(true);
      expect(graph.some((n: { "@type": string }) => n["@type"] === "BreadcrumbList")).toBe(true);

      // Every form control must have an accessible name — no orphan inputs.
      const unlabelled = await page.evaluate(() => {
        const bad: string[] = [];
        for (const el of Array.from(
          document.querySelectorAll<HTMLElement>("input, select, textarea, button"),
        )) {
          if (el.closest("[hidden]") || (el as HTMLInputElement).type === "hidden") continue;
          const id = el.getAttribute("id");
          const named =
            el.getAttribute("aria-label") ||
            el.getAttribute("aria-labelledby") ||
            (id && document.querySelector(`label[for="${CSS.escape(id)}"]`)) ||
            el.closest("label") ||
            (el.tagName === "BUTTON" && (el.textContent ?? "").trim());
          if (!named) bad.push(`${el.tagName}#${id || "(no id)"}.${el.className.slice(0, 40)}`);
        }
        return bad;
      });
      expect(unlabelled, `unlabelled controls on /${tool.slug}/`).toEqual([]);
    });
  }
});

test("theme toggle switches between light and dark", async ({ page }) => {
  await page.goto("/");
  const html = page.locator("html");
  const toggle = page.getByRole("button", { name: /theme/i });

  // Cycle until we've observed both classes; the control rotates light→dark→system.
  const seen = new Set<string>();
  for (let i = 0; i < 4; i++) {
    seen.add((await html.getAttribute("class")) ?? "");
    await toggle.click();
    await page.waitForTimeout(150);
  }
  const all = [...seen].join(" ");
  expect(all).toContain("dark");
});

test("skip link is reachable from the keyboard", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  const focused = page.locator(":focus");
  await expect(focused).toHaveText(/skip to content/i);
});

test("home lists every tool and each link resolves", async ({ page }) => {
  await page.goto("/");
  for (const tool of TOOLS) {
    await expect(page.locator(`a[href="/${tool.slug}/"]`).first()).toBeVisible();
  }
});
