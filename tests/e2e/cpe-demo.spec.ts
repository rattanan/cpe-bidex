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
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    async function login(user: typeof tester) {
      await page.goto("/login");
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
    await page.setViewportSize({ width: 390, height: 844 });
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
