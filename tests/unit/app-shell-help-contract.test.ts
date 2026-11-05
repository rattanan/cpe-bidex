import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getHelpArticle, getRelatedHelpArticles, getRelevantHelpArticles, helpArticles, searchHelpArticles } from "../../lib/help-center";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("App shell and Help Center", () => {
  it("provides collapsible grouped navigation and a notification dropdown", () => {
    const shell = read("components/app-shell.tsx");
    const css = read("app/globals.css");
    expect(shell).toContain("ntop-sidebar-collapsed");
    expect(shell).toContain("sidebar-submenu");
    expect(shell).toContain("sidebar-submenu-list");
    expect(css).toContain(".sidebar-submenu-list { min-height:0;overflow:hidden; }");
    expect(css).not.toContain("max-height:320px");
    expect(shell).toContain("notification-panel");
    expect(shell).toContain("<CompanyBrand compact />");
    expect(shell).not.toContain("Sales Platform");
    expect(shell).toContain('href="/help"');
    expect(shell).toContain('href: "/admin/users"');
    expect(shell).toContain('href: "/admin/audit"');
  });

  it("loads notifications from owned production records instead of mock data", () => {
    const query = read("lib/notifications/header-notifications.ts");
    expect(query).toContain("ownerId: actorId");
    expect(query).toContain("makerId: actorId");
    expect(query).not.toContain("mock");
  });

  it("searches current CPE guides and resolves retained legacy URLs", () => {
    expect(searchHelpArticles("BOQ", "ESTIMATOR").map((item) => item.slug)).toContain("cpe-boq-estimation");
    expect(searchHelpArticles("RFQ PO", "PROCUREMENT").map((item) => item.slug)).toContain("cpe-rfq-po");
    expect(getHelpArticle("customer-to-opportunity")?.legacy).toBe(true);
    expect(getHelpArticle("ai-page-assistant")?.audience).toContain("ALL");
    expect(getRelevantHelpArticles("/cpe/sales opportunity", 3).map((item) => item.slug)).toContain("cpe-sales-opportunities");
  });

  it("keeps the old workflow guide reachable without putting it in the CPE catalog", () => {
    const article = getHelpArticle("opportunity-transition-policy");
    expect(article?.legacy).toBe(true);
    expect(article?.sections.flatMap((section) => section.body).join(" ")).toContain("ไม่บังคับเดินตามลำดับ");
    expect(helpArticles.some((item) => item.slug === article?.slug)).toBe(false);
  });

  it("only links current guides to existing current guides", () => {
    for (const article of helpArticles) {
      const related = getRelatedHelpArticles(article);
      expect(related).toHaveLength(article.relatedSlugs?.length ?? 0);
      expect(related.every(item => !item.legacy)).toBe(true);
    }
  });
});
