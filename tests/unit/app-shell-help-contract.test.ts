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
    expect(shell).toContain("BID EXCELLENCE");
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

  it("searches NTOP help articles and resolves article routes", () => {
    expect(searchHelpArticles("floor price", "SALES").map((item) => item.slug)).toContain("quotation-and-approval");
    expect(searchHelpArticles("Transition Policy", "SALES").map((item) => item.slug)).toContain("opportunity-transition-policy");
    expect(searchHelpArticles("ขั้นตอนใดก็ได้", "ADMIN").map((item) => item.slug)).toContain("opportunity-transition-policy");
    expect(getHelpArticle("customer-to-opportunity")?.category).toBe("Customer & Opportunity");
    expect(getHelpArticle("ai-page-assistant")?.audience).toContain("ALL");
    expect(getRelevantHelpArticles("opportunity", 3).map((item) => item.slug)).toContain("customer-to-opportunity");
  });

  it("covers the current governed sales journey with detailed, current articles", () => {
    expect(helpArticles.map((article) => article.slug)).toEqual(expect.arrayContaining([
      "ai-page-assistant", "prospect-to-lead", "lead-qualification-and-conversion",
      "customer-to-opportunity", "opportunity-transition-policy", "notifications-and-tasks", "sales-pipeline-and-forecast",
      "presales-solution-survey-boq", "proposal-and-ai-draft", "quotation-and-approval",
      "contract-to-service-order", "ai-assistance-and-safety", "workflow-administration",
    ]));
    expect(helpArticles.filter((article) => article.slug !== "opportunity-transition-policy").every((article) => article.updatedAt === "2026-08-24")).toBe(true);
    expect(getHelpArticle("opportunity-transition-policy")?.updatedAt).toBe("2026-08-26");
    expect(helpArticles.every((article) => article.sections.length >= 4 && article.faqs.length >= 2)).toBe(true);
  });

  it("documents unrestricted Opportunity stage selection and retained controls", () => {
    const article = getHelpArticle("opportunity-transition-policy");
    const content = article?.sections.flatMap((section) => section.body).join(" ") ?? "";
    expect(article?.title).toContain("แบบอิสระ");
    expect(content).toContain("Stage อื่นทุกค่าให้เลือก");
    expect(content).toContain("ไม่บังคับเดินตามลำดับ");
    expect(content).toContain("Requirements, Coverage, Solution และ Quote ไม่ block");
    expect(content).toContain("Lost Reason และ Lost Category");
    expect(content).toContain("Cancelled Reason");
    expect(content).toContain("permission opportunity.transition");
    expect(content).toContain("Expected Version");
    expect(content).toContain("Idempotency Key");
  });

  it("searches article guidance and FAQs, not only card metadata", () => {
    expect(searchHelpArticles("malware scan", "SALES").map((item) => item.slug)).toContain("contract-to-service-order");
    expect(searchHelpArticles("training consent", "ALL").map((item) => item.slug)).toContain("ai-assistance-and-safety");
    expect(searchHelpArticles("Round Robin", "ADMIN").map((item) => item.slug)).toContain("workflow-administration");
  });

  it("only links to existing related help articles", () => {
    for (const article of helpArticles) {
      expect(getRelatedHelpArticles(article)).toHaveLength(article.relatedSlugs?.length ?? 0);
    }
  });
});
