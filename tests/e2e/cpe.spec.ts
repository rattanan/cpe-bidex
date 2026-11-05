import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import { randomUUID } from "node:crypto";
const enabled = process.env.CPE_E2E === "1";
test.describe("CPE live workspace", () => {
  test.skip(
    !enabled,
    "Requires an explicitly configured local CPE test database",
  );
  let email: string;
  let userId: string;
  let org: string;
  test.beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!);
    if (
      !/^cpe_.*test/.test(url.pathname.slice(1)) ||
      url.hostname !== "127.0.0.1"
    )
      throw new Error("Use an isolated local CPE test database");
    const db = new PrismaClient();
    try {
      org = (
        await db.organizationUnit.create({
          data: { code: `E2E-${randomUUID()}`, name: "CPE ทดสอบหน้าจอ" },
        })
      ).id;
      email = `cpe-e2e-${randomUUID()}@example.test`;
      const user = await db.user.create({
        data: {
          email,
          name: "ผู้ทดสอบหน้าจอ",
          passwordHash: await hash("Cpe-Test-Only-2026!", 4),
          role: "ADMIN",
        },
      });
      userId = user.id;
      await db.userRoleAssignment.create({
        data: {
          userId,
          organizationUnitId: org,
          roleCode: "ADMIN",
          scopeCode: "ORG_UNIT",
          effectiveFrom: new Date("2020-01-01T00:00:00Z"),
        },
      });
    } finally {
      await db.$disconnect();
    }
  });
  test("all twelve screens, BOQ-to-won workflow and responsive drawer", async ({
    page,
  }) => {
    test.setTimeout(180000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/login");
    await page.getByLabel("อีเมล").fill(email);
    await page
      .getByLabel("รหัสผ่าน", { exact: true })
      .fill("Cpe-Test-Only-2026!");
    await page
      .getByRole("button", { name: "เข้าสู่ระบบ", exact: true })
      .click();
    await expect(page).toHaveURL(/\/cpe\/exec/);
    for (const [screen, title] of [
      ["exec", "แดชบอร์ดผู้บริหาร"],
      ["sales", "โอกาสการขาย"],
      ["estimate", "ประมาณราคา / BOQ"],
      ["costcheck", "ตรวจต้นทุนก่อนส่งฝ่ายขาย"],
      ["bidsim", "วิเคราะห์ราคาก่อนเสนอ"],
      ["catalog", "ฐานข้อมูลต้นทุนกลาง"],
      ["forecast", "พยากรณ์ราคาวัสดุ"],
      ["procurement", "จัดซื้อและสรรหาผู้รับเหมา"],
      ["vendors", "ทะเบียนและประเมินผู้รับเหมา"],
      ["projects", "บริหารโครงการ"],
      ["cash", "การเงินและกระแสเงินสด"],
      ["knowledge", "คลังข้อมูลและ Data Master"],
    ]) {
      await page.goto(`/cpe/${screen}`);
      await expect(
        page.getByRole("heading", { name: title, exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("navigation", { name: "กระบวนการทำงาน 9 ขั้น" }),
      ).toBeVisible();
    }
    await page.goto("/cpe/sales");
    await page.getByRole("button", { name: "รับงานใหม่", exact: true }).click();
    const drawer = page.getByRole("dialog");
    await expect(drawer).toBeVisible();
    await drawer.getByLabel("ชื่องาน", { exact: false }).fill("อาคารทดสอบ E2E");
    await drawer.getByLabel("ลูกค้า", { exact: true }).fill("ลูกค้า E2E");
    await drawer.getByLabel("ประเภทลูกค้า").selectOption({ label: "งานเอกชน" });
    await drawer.getByLabel("ประเภทงาน").selectOption({ label: "งานก่อสร้าง" });
    await drawer.getByLabel("สถานที่").fill("กรุงเทพฯ");
    await drawer.getByLabel("หน่วยขนาดงาน").selectOption({ label: "ตร.ม." });
    await drawer.getByLabel("ขนาดงาน", { exact: true }).fill("100");
    await drawer.getByLabel("ต้นทุนเบื้องต้น").fill("100000");
    await drawer.getByLabel("กำไรที่ต้องการ").fill("15");
    await drawer.getByLabel("ผู้ประมาณราคา").selectOption(userId);
    await drawer.getByLabel("กำหนดยื่นราคา").fill("2027-01-01");
    await drawer.getByRole("button", { name: "บันทึก", exact: true }).click();
    await expect(drawer).not.toBeVisible();
    await expect(
      page.getByRole("link", { name: "อาคารทดสอบ E2E", exact: true }),
    ).toBeVisible();
    await page.goto("/cpe/estimate");
    for (const i of [5, 4, 3, 2])
      await page
        .getByRole("button", { name: `ลบรายการ ${i}`, exact: true })
        .click();
    await page.getByLabel("รหัสแถว 1", { exact: true }).fill("ST-E2E");
    await page
      .getByLabel("รายละเอียดแถว 1", { exact: true })
      .fill("โครงสร้างทดสอบ");
    await page.getByLabel("quantity แถว 1").fill("100");
    await page.getByLabel("material แถว 1").fill("100");
    await page.getByLabel("labor แถว 1").fill("20");
    await page
      .getByRole("button", {
        name: "บันทึก BOQ และคำนวณต้นทุนใหม่",
        exact: true,
      })
      .click();
    await expect(page.getByText(/รุ่น 2/)).toBeVisible();
    await page.goto("/cpe/costcheck");
    await page
      .getByRole("button", {
        name: "ยืนยันผลตรวจและส่งให้ฝ่ายขาย",
        exact: true,
      })
      .click();
    await expect(page.getByText(/ยืนยันต้นทุนแล้วเมื่อ/)).toBeVisible();
    await page.goto("/cpe/bidsim");
    await page
      .getByRole("button", { name: "ใช้ราคานี้เป็นราคาเสนอ", exact: true })
      .click();
    await expect(page.getByText("บันทึกสำเร็จ", { exact: true })).toBeVisible();
    await page.goto("/cpe/sales");
    await page
      .getByRole("link", { name: "อาคารทดสอบ E2E", exact: true })
      .click();
    const detail = page.getByRole("dialog");
    await detail.getByLabel("เลขที่สัญญา / ใบสั่งจ้าง").fill("CT-E2E");
    await detail.getByLabel("ระยะเวลา (เดือน)").fill("2");
    await detail.getByLabel("วันเริ่มงาน").fill("2026-11-01");
    await detail.getByLabel("ผู้จัดการโครงการ").selectOption(userId);
    await detail.getByLabel("สร้างชุดขอราคาตามหมวด BOQ อัตโนมัติ").check();
    await detail
      .getByRole("button", { name: "ยืนยันได้งานและเปิดโครงการ", exact: true })
      .click();
    await expect(
      detail.getByText("เปิดโครงการแล้ว:", { exact: false }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await page.goto("/cpe/projects");
    await page
      .getByRole("link", { name: "อาคารทดสอบ E2E", exact: true })
      .click();
    await expect(
      page.getByRole("img", { name: "ความคืบหน้าแผนและจริง" }),
    ).toBeVisible();
    await page.screenshot({
      path: "/tmp/cpe-requirements-review/project-desktop.png",
      fullPage: true,
    });
    await page.keyboard.press("Escape");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/cpe/sales");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page
      .getByRole("link", { name: "อาคารทดสอบ E2E", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.screenshot({
      path: "/tmp/cpe-requirements-review/sales-mobile.png",
      fullPage: true,
    });
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/cpe/exec");
    await page.screenshot({
      path: "/tmp/cpe-requirements-review/dashboard-desktop.png",
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });
});
