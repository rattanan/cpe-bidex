import { describe, expect, it } from "vitest";
import { SCREENS } from "../../../lib/cpe/config";
import { HELP_AUDIENCES, getHelpArticle, getRelevantHelpArticles, helpArticles, searchHelpArticles } from "../../../lib/help-center";

describe("CPE Bidex Help Center", () => {
  it("covers each live workspace with reviewed, actionable guides", () => {
    expect(helpArticles).toHaveLength(17);
    expect(new Set(helpArticles.map(article => article.slug)).size).toBe(helpArticles.length);
    for (const screen of SCREENS) expect(helpArticles.some(article => article.workspaceHref === `/cpe/${screen.id}`)).toBe(true);
    for (const article of helpArticles) {
      expect(article.updatedAt).toBe("2026-11-06");
      expect(article.sections.length).toBeGreaterThanOrEqual(4);
      expect(article.faqs.length).toBeGreaterThanOrEqual(2);
      expect(article.legacy).not.toBe(true);
      expect(article.audience.every(role => role === "ALL" || HELP_AUDIENCES.some(item => item === role))).toBe(true);
    }
  });

  it.each(SCREENS)("ranks the $id guide for actual CPE route context", ({ id }) => {
    const articles = getRelevantHelpArticles(`/cpe/${id}?org=demo หน้านี้ใช้อย่างไร`, 3);
    expect(articles[0].slug).toBe("ai-page-assistant");
    expect(articles[1].workspaceHref).toBe(`/cpe/${id}`);
    expect(articles.every(article => helpArticles.includes(article))).toBe(true);
  });

  it("searches body/FAQ and multiple terms, with current role filters", () => {
    expect(searchHelpArticles("RFQ PO", "PROCUREMENT").map(article => article.slug)).toContain("cpe-rfq-po");
    expect(searchHelpArticles("วงเงินสินเชื่อ", "EXECUTIVE").map(article => article.slug)).toContain("cpe-cash-flow");
    expect(searchHelpArticles("ผู้เสนออนุมัติข้อเสนอของตนเอง", "EXECUTIVE").map(article => article.slug)).toContain("cpe-knowledge-master");
    expect(searchHelpArticles("", "PROCUREMENT").map(article => article.slug)).not.toContain("cpe-cost-review");
    expect(searchHelpArticles("", "PROJECT_MANAGER").map(article => article.slug)).toContain("cpe-project-management");
    expect(searchHelpArticles("BOQ", "PRESALES").map(article => article.slug)).toContain("cpe-boq-estimation");
    expect(searchHelpArticles("no-such-cpe-guide-999", "")).toEqual([]);
  });

  it("keeps old URLs usable while excluding old sales instructions from search and AI", () => {
    expect(getHelpArticle("contract-to-service-order")?.legacy).toBe(true);
    expect(getHelpArticle("missing-article")).toBeUndefined();
    expect(searchHelpArticles("Round Robin", "ADMIN")).toEqual([]);
    expect(getRelevantHelpArticles("/prospects old lead floor price", 3).every(article => !article.legacy)).toBe(true);
    expect(getRelevantHelpArticles("/help/cpe-boq-estimation", 3)[1].slug).toBe("cpe-boq-estimation");
  });

  it("bounds AI sources and documents real capability limits", () => {
    expect(getRelevantHelpArticles("BOQ RFQ", 99).length).toBeLessThanOrEqual(3);
    expect(getRelevantHelpArticles("BOQ", 0)).toEqual([]);
    const text = (slug: string) => getHelpArticle(slug)!.sections.flatMap(section => section.body).join(" ");
    expect(text("cpe-rfq-po")).toContain("ไม่ใช่การอัปโหลด");
    expect(text("cpe-material-forecast")).toContain("ไม่มีการดึงราคาตลาด");
    expect(text("cpe-knowledge-master")).toContain("ไม่อนุญาตให้ผู้เสนออนุมัติข้อเสนอของตนเอง");
    expect(text("ai-page-assistant")).toContain("12 หน้า CPE");
    expect(text("cpe-forms-troubleshooting")).toContain("ไม่ใช่ปุ่มยืนยันสัญญา");
  });
});
