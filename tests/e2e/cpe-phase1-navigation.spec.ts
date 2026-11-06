import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

test("Phase 1 menus, search, shortcuts and mobile navigation use the same scope", async ({ page }) => {
  test.skip(process.env.CPE_PHASE1_E2E !== "1", "Requires explicitly supplied CPE admin credentials");
  const credentialsFile = process.env.CPE_ADMIN_CREDENTIALS_FILE;
  if (!credentialsFile) throw new Error("Provide protected CPE admin credentials");
  const user = JSON.parse(readFileSync(credentialsFile, "utf8"));
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/login");
  await page.getByLabel("อีเมล").fill(user.email);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(user.password);
  await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
  await expect(page).toHaveURL(/\/cpe\//);

  const sidebar = page.getByRole("navigation", { name: "เมนูหลัก", exact: true });
  await expect(sidebar.locator('[aria-disabled="true"]')).toHaveCount(6);
  await expect(sidebar.locator('a[href="/cpe/estimate"]')).toBeVisible();
  await expect(sidebar.locator('a[href="/admin/users"]')).toBeVisible();
  for (const screen of ["forecast", "procurement", "vendors", "projects", "cash", "knowledge"]) {
    await expect(sidebar.locator(`a[href="/cpe/${screen}"]`)).toHaveCount(0);
  }
  await expect(sidebar.getByText("เปิดใช้ในเฟสถัดไป", { exact: true })).toHaveCount(6);

  await page.goto("/cpe/sales");
  const processNav = page.getByRole("navigation", { name: "กระบวนการทำงาน 9 ขั้น" });
  await expect(processNav.locator('a')).toHaveCount(5);
  await expect(processNav.locator('[aria-disabled="true"]')).toHaveCount(4);
  await page.locator(".quick-create summary").click();
  await expect(page.locator('.quick-create-menu a')).toHaveCount(2);
  await expect(page.locator('.quick-create-menu a[href^="/cpe/vendors"]')).toHaveCount(0);
  await page.locator(".quick-create summary").click();

  // Persisted favorites must not restore a disabled menu to search results.
  await page.evaluate(() => localStorage.setItem("ntop-favorite-routes", JSON.stringify(["/cpe/projects"])));
  await page.reload();
  await page.getByRole("button", { name: "เปิดการค้นหาและเมนูคำสั่ง" }).click();
  await page.getByRole("combobox", { name: "ค้นหาเมนูและคำสั่ง" }).fill("บริหารโครงการ");
  await expect(page.locator(".command-result-main")).toHaveCount(0);
  await page.getByRole("combobox", { name: "ค้นหาเมนูและคำสั่ง" }).fill("ประมาณราคา");
  await expect(page.locator(".command-result-main")).toHaveCount(1);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/cpe\/estimate/);

  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = page.getByRole("navigation", { name: "เมนู CPE สำหรับจอเล็ก" });
  await expect(mobile).toBeVisible();
  await expect(mobile.locator('[aria-disabled="true"]')).toHaveCount(6);
  await expect(mobile.locator('a[href="/cpe/sales"]')).toHaveCount(1);
  await expect(mobile.locator('a[href="/cpe/projects"]')).toHaveCount(0);
  await expect(mobile.locator('[aria-disabled="true"]').first()).toHaveAttribute("title", /เปิดใช้ในเฟสถัดไป/);
  // The sidebar margin animates on resize; inspect the final mobile geometry.
  await expect.poll(() => page.locator(".app-workspace").evaluate(element => element.getBoundingClientRect().left)).toBe(0);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: "/tmp/cpe-phase1-mobile.png" });
  expect(errors).toEqual([]);
});
