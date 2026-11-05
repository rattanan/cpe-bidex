import fs from "node:fs";
import { test, expect } from "@playwright/test";
import { helpArticles } from "../../lib/help-center";
import { expectReadableText } from "./helpers/contrast";

test.describe("CPE Bidex help guides", () => {
  test.use({ actionTimeout: 10000 });
  test.skip(process.env.CPE_DEMO_E2E !== "1", "Requires an explicit authenticated CPE preview");
  test("current guides, role search, workspace links, FAQs and archived URLs", async ({ page }) => {
    test.setTimeout(120000);
    const file = process.env.CPE_DEMO_CREDENTIALS_FILE;
    if (!file) throw new Error("Provide protected demo credentials");
    const user = JSON.parse(fs.readFileSync(file, "utf8")).accounts.find((account: { key: string }) => account.key === "tester");
    await page.goto("/login");
    await page.getByLabel("อีเมล").fill(user.email);
    await page.getByLabel("รหัสผ่าน", { exact: true }).fill(user.password);
    await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
    await expect(page).toHaveURL(/\/cpe\//);
    await page.setViewportSize({ width: 1440, height: 1050 });
    await page.goto("/help");
    await expect(page.getByRole("heading", { name: "ศูนย์ช่วยเหลือ CPE Bidex", exact: true })).toBeVisible();
    await expect(page.locator(".help-card")).toHaveCount(17);
    await expect(page.locator(".help-cards")).not.toContainText("Prospect");
    fs.mkdirSync("/tmp/cpe-demo-preview", { recursive: true });
    await page.screenshot({ path: "/tmp/cpe-demo-preview/help-center.png" });
    await page.getByLabel("ค้นหาคู่มือ CPE Bidex", { exact: true }).fill("RFQ PO");
    await page.getByLabel("กรองตามบทบาท", { exact: true }).selectOption("PROCUREMENT");
    await page.getByRole("button", { name: "ค้นหา", exact: true }).click();
    await page.getByRole("link").filter({ has: page.getByRole("heading", { name: "สร้าง RFQ เปรียบเทียบใบเสนอราคา และออก PO", exact: true }) }).click();
    await expect(page.getByRole("link", { name: "ไปยังหน้าทำงาน →", exact: true })).toHaveAttribute("href", "/cpe/procurement");
    await page.locator(".help-faq summary").filter({ hasText: "ทำไมออก PO ไม่ได้" }).click();
    await expect(page.locator(".help-faq details[open]")).toContainText("ความครบของเอกสาร");
    for (const article of helpArticles) {
      await page.goto(`/help/${article.slug}`);
      await expect(page.getByRole("heading", { level: 1, name: article.title, exact: true })).toBeVisible();
      await expect(page.getByRole("link", { name: "ไปยังหน้าทำงาน →", exact: true })).toHaveAttribute("href", article.workspaceHref!);
      await expect(page.locator(".help-article")).not.toContainText("Round Robin");
    }
    await page.goto("/help/cpe-boq-estimation");
    for (const theme of ["dark", "light"]) {
      await page.getByRole("button", { name: theme === "dark" ? "ใช้โหมดมืด" : "ใช้โหมดสว่าง", exact: true }).click();
      await expectReadableText(page.locator(".help-article p").first());
    }
    await page.screenshot({ path: "/tmp/cpe-demo-preview/help-boq.png" });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect.poll(() => page.locator(".app-workspace").evaluate(element => getComputedStyle(element).marginLeft)).toBe("0px");
    await expect.poll(() => page.locator(".help-article").evaluate(element => element.getBoundingClientRect().width)).toBeGreaterThanOrEqual(350);
    await page.screenshot({ path: "/tmp/cpe-demo-preview/help-mobile.png", fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await page.locator(".help-article p").first().evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16);
    await page.goto("/help");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.goto("/help/prospect-to-lead");
    await expect(page.getByRole("note")).toContainText("คู่มือระบบเดิม");
    await page.getByRole("link", { name: "เปิดคู่มือ CPE Bidex ปัจจุบัน", exact: true }).click();
    await expect(page.locator(".help-card")).toHaveCount(17);
  });
});
