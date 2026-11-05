import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { PROCESS } from "../../lib/cpe/config";

// Exercise the real shell styles without requiring business records or a database.
const styles = ["app/globals.css", "components/cpe/cpe.css", "components/company-brand.css"]
  .map((path) => readFileSync(join(process.cwd(), path), "utf8"))
  .join("\n");

for (const width of [320, 390, 860, 1024, 1400, 1440, 1728]) {
  for (const collapsed of [false, true]) {
    test(`nine process steps fit at ${width}px, sidebar ${collapsed ? "collapsed" : "expanded"}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.setContent(`
        <html lang="th" data-theme="dark"><head><style>${styles}</style></head>
        <body><div class="app-frame cpe-app ${collapsed ? "sidebar-collapsed" : ""}">
          <main class="app-workspace"><div class="content"><div class="cpe-workspace">
            <nav class="cpe-process" aria-label="กระบวนการทำงาน 9 ขั้น">
              ${PROCESS.map(([label, target], index) => index % 2
                ? `<span class="unavailable"><small>0${index + 1}</small><span>${label}</span></span>`
                : `<a href="/cpe/${target}" class="${index === 0 ? "active" : ""}"><small>0${index + 1}</small><span>${label}</span></a>`).join("")}
            </nav>
          </div></div></main>
        </div></body></html>`);
      const nav = page.getByRole("navigation", { name: "กระบวนการทำงาน 9 ขั้น" });
      await expect(nav.locator(":scope > *")).toHaveCount(9);
      const layout = await nav.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        const steps = [...element.children].map((child) => {
          const rect = child.getBoundingClientRect();
          return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
            fits: child.scrollWidth <= child.clientWidth + 1 };
        });
        return { left: bounds.left, right: bounds.right, bottom: bounds.bottom,
          fits: element.scrollWidth <= element.clientWidth + 1, steps };
      });
      expect(layout.fits).toBe(true);
      expect(layout.left).toBeGreaterThanOrEqual(0);
      expect(layout.right).toBeLessThanOrEqual(width);
      for (const step of layout.steps) {
        expect(step.fits).toBe(true);
        expect(step.left).toBeGreaterThanOrEqual(layout.left);
        expect(step.right).toBeLessThanOrEqual(layout.right);
        expect(step.bottom).toBeLessThanOrEqual(layout.bottom);
      }
      expect(new Set(layout.steps.map((step) => Math.round(step.top))).size)
        .toBe(width > 1400 ? 1 : 3);
      await nav.locator("a").first().focus();
      await expect(nav.locator("a").first()).toBeFocused();
    });
  }
}

test("live CPE navigation fits with actual page content and fonts", async ({ page }) => {
  test.skip(process.env.CPE_DEMO_E2E !== "1", "Requires explicit CPE preview credentials");
  const credentialsFile = process.env.CPE_DEMO_CREDENTIALS_FILE;
  if (!credentialsFile) throw new Error("Provide protected demo credentials");
  const user = JSON.parse(readFileSync(credentialsFile, "utf8")).accounts
    .find((account: { key: string }) => account.key === "tester");
  await page.goto("/login");
  await page.getByLabel("อีเมล").fill(user.email);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
  await expect(page).toHaveURL(/\/cpe\//);
  await page.goto("/cpe/vendors");
  for (const width of [320, 390, 860, 1024, 1400, 1440, 1728]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => document.fonts.ready);
    const nav = page.getByRole("navigation", { name: "กระบวนการทำงาน 9 ขั้น" });
    await expect(nav.locator(":scope > *")).toHaveCount(9);
    expect(await nav.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return bounds.left >= 0 && bounds.right <= innerWidth && element.scrollWidth <= element.clientWidth + 1
        && [...element.children].every((child) => {
          const rect = child.getBoundingClientRect();
          return rect.left >= bounds.left && rect.right <= bounds.right
            && child.scrollWidth <= child.clientWidth + 1;
        });
    })).toBe(true);
  }
});
