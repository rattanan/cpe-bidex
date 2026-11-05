import fs from "node:fs";
import { test, expect } from "@playwright/test";
import { SCREENS } from "../../lib/cpe/config";

test.describe("CPE assistant availability", () => {
  test.skip(process.env.CPE_DEMO_E2E !== "1", "Requires explicit CPE preview credentials");
  test.use({ actionTimeout: 10000 });
  test("opens on every CPE screen and remains accessible on portrait/landscape mobile", async ({ page }) => {
    test.setTimeout(120000);
    const file = process.env.CPE_DEMO_CREDENTIALS_FILE;
    if (!file) throw new Error("Provide protected demo credentials");
    const user = JSON.parse(fs.readFileSync(file, "utf8")).accounts.find((account: { key: string }) => account.key === "tester");
    await page.goto("/login");
    await expect(page.getByRole("button", { name: "เปิด AI Assistant", exact: true })).toHaveCount(0);
    await page.getByLabel("อีเมล").fill(user.email);
    await page.getByLabel("รหัสผ่าน", { exact: true }).fill(user.password);
    await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
    await expect(page).toHaveURL(/\/cpe\//);
    const launcher = page.getByRole("button", { name: "เปิด AI Assistant", exact: true });
    const panel = page.getByRole("dialog", { name: "CPE AI Assistant", exact: true });
    for (const path of [...SCREENS.map(screen => `/cpe/${screen.id}`), "/company", "/help"]) {
      await page.goto(path);
      await expect(launcher).toBeInViewport();
      await launcher.click();
      await expect(panel).toBeVisible();
      await expect(panel.getByLabel("ถามเกี่ยวกับหน้าปัจจุบัน")).toBeFocused();
      await expect(panel).toContainText("ไม่แก้ไขข้อมูลในระบบ");
      await page.keyboard.press("Escape");
      await expect(panel).not.toBeVisible();
      await expect(launcher).toBeFocused();
    }
    await page.goto("/cpe/estimate");
    for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(viewport);
      await expect(launcher).toBeInViewport();
      await launcher.click();
      await expect(panel).toBeVisible();
      await expect(panel.getByRole("button", { name: "ปิด AI Assistant", exact: true })).toBeInViewport();
      await panel.getByRole("button", { name: "ปิด AI Assistant", exact: true }).click();
      await expect(launcher).toBeInViewport();
      await launcher.click();
      await page.keyboard.press("Escape");
      await expect(launcher).toBeFocused();
    }
    // Exercise the failure UI without contacting a paid AI provider or changing records.
    await page.route("**/api/v1/ai/page-assistant", route => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { message: "Unavailable" } }) }));
    await launcher.click();
    await panel.getByLabel("ถามเกี่ยวกับหน้าปัจจุบัน").fill("หน้านี้ใช้อย่างไร");
    const requestPromise = page.waitForRequest("**/api/v1/ai/page-assistant");
    await panel.getByRole("button", { name: "ส่งคำถาม", exact: true }).click();
    const body = (await requestPromise).postDataJSON();
    expect(body.pathname).toBe("/cpe/estimate");
    expect(body.pageTitle).toContain("BOQ");
    expect(body.pageContent).toContain("BOQ");
    expect(body.conversation).toEqual([]);
    await expect(panel.getByRole("alert")).toContainText("AI ยังไม่พร้อมใช้งาน");
    await panel.getByRole("button", { name: "ปิด AI Assistant", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: "ประมาณราคา / BOQ", exact: true })).toBeVisible();
  });
});
