import fs from "node:fs";
import { test, expect } from "@playwright/test";
import { SCREENS } from "../../lib/cpe/config";
const enabled = process.env.CPE_DEMO_E2E === "1";
test.describe("CPE seeded prototype preview", () => {
  test.skip(
    !enabled,
    "Requires the explicit local demo seed and its protected credential file",
  );
  test("renders the populated screens and checks a restricted PM account", async ({
    page,
  }) => {
    test.setTimeout(120000);
    const file = process.env.CPE_DEMO_CREDENTIALS_FILE;
    if (!file) throw new Error("Provide the protected demo credential file");
    const credentials = JSON.parse(fs.readFileSync(file, "utf8")) as {
      accounts: { key: string; email: string; password: string }[];
    };
    const tester = credentials.accounts.find((u) => u.key === "tester")!;
    fs.mkdirSync("/tmp/cpe-demo-preview", { recursive: true });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    async function login(user: typeof tester) {
      await page.goto("/login");
      if (user.key === "tester") {
        await page.setViewportSize({ width: 1440, height: 1050 });
        await page.screenshot({ path: "/tmp/cpe-demo-preview/login.png", fullPage: true });
        await page.setViewportSize({ width: 390, height: 844 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        await page.screenshot({ path: "/tmp/cpe-demo-preview/login-mobile.png", fullPage: true });
        await page.setViewportSize({ width: 1440, height: 1050 });
      }
      await expect(page.getByRole("img", { name: /ตราสัญลักษณ์/ })).toBeVisible();
      expect(await page.getByLabel("อีเมล").evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(16);
      await page.getByLabel("อีเมล").fill(user.email);
      await page.getByLabel("รหัสผ่าน", { exact: true }).fill(user.password);
      await page
        .getByRole("button", { name: "เข้าสู่ระบบ", exact: true })
        .click();
      await expect(page).toHaveURL(/\/cpe\//);
    }
    await login(tester);
    for (const screen of SCREENS) {
      await page.goto(`/cpe/${screen.id}`);
      await expect(
        page.getByRole("heading", { name: screen.label, exact: true }),
      ).toBeVisible();
      expect(await page.locator("h1").evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(26);
      if (screen.id !== "exec") expect(await page.locator("table.table").first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(15);
      if (screen.id !== "exec")
        expect(
          await page.locator("table.table > tbody > tr").count(),
        ).toBeGreaterThan(0);
    }
    fs.mkdirSync("/tmp/cpe-demo-preview", { recursive: true });
    await page.setViewportSize({ width: 1440, height: 1050 });
    await page.goto("/cpe/exec");
    await page.screenshot({
      path: "/tmp/cpe-demo-preview/dashboard.png",
      fullPage: true,
    });
    await page.goto("/cpe/sales?q=OPP-68");
    await expect(
      page.getByRole("link", {
        name: "Solar Rooftop 2.4 MWp โรงงานผลิตชิ้นส่วนยานยนต์",
        exact: true,
      }),
    ).toBeVisible();
    await page.screenshot({
      path: "/tmp/cpe-demo-preview/sales.png",
      fullPage: true,
    });
    await page.goto("/cpe/catalog");
    await expect(
      page.getByText("MAT-STL-001", { exact: false }).first(),
    ).toBeVisible();
    await page.screenshot({
      path: "/tmp/cpe-demo-preview/catalog.png",
      fullPage: true,
    });
    await page.goto("/cpe/cash");
    await expect(
      page.getByRole("heading", {
        name: "ลูกหนี้แยกตามอายุกำหนดชำระ",
        exact: true,
      }),
    ).toBeVisible();
    await page.screenshot({
      path: "/tmp/cpe-demo-preview/cash.png",
      fullPage: true,
    });
    await page.goto("/company");
    await expect(page.getByRole("heading", { level: 1, name: /วิศวกรรมที่สร้างคุณค่า/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "02-780-2890" })).toHaveAttribute("href", "tel:+6627802890");
    await expect(page.getByRole("link", { name: "info@cpe.co.th", exact: true })).toHaveAttribute("href", "mailto:info@cpe.co.th");
    await page.screenshot({ path: "/tmp/cpe-demo-preview/company.png", fullPage: true });
    await page.getByRole("button", { name: "ใช้โหมดมืด", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.screenshot({ path: "/tmp/cpe-demo-preview/company-dark.png", fullPage: true });
    await page.getByRole("button", { name: "ใช้โหมดสว่าง", exact: true }).click();
    await page.goto("/help");
    await expect(page.getByRole("heading", { name: "ศูนย์ช่วยเหลือ CPE", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "เปิด AI Assistant", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "CPE AI Assistant", exact: true })).toBeVisible();
    await expect(page.getByText("NTOP AI Assistant", { exact: true })).toHaveCount(0);
    await page.screenshot({ path: "/tmp/cpe-demo-preview/ai-assistant.png", fullPage: true });
    await page.getByRole("button", { name: "ปิด AI Assistant", exact: true }).first().click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/company");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: "/tmp/cpe-demo-preview/company-mobile.png", fullPage: true });
    await page.goto("/cpe/exec");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: "/tmp/cpe-demo-preview/mobile.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 1050 });
    await page.getByRole("button", { name: "ออกจากระบบ", exact: true }).click();
    await login(credentials.accounts.find((u) => u.key === "pm")!);
    await page.goto("/cpe/sales");
    await expect(
      page.getByRole("heading", {
        name: "ไม่มีสิทธิ์เข้าถึงหน้านี้",
        exact: true,
      }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });
});
