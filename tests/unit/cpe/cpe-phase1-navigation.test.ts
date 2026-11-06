import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CPE_ROLE_GRANTS, LATER_PHASE_MESSAGE, PROCESS, isPhase1Screen } from "../../../lib/cpe/config";
import { enabledCpeNavigation, visibleCpeNavigation, visibleCpeQuickCreate } from "../../../components/cpe/navigation";
import { NAVIGATION_PERMISSIONS } from "../../../lib/authorization/navigation-permissions";
import { CpeNavigationLink } from "../../../components/cpe/navigation-link";

describe("Phase 1 navigation", () => {
  const permissions = [...CPE_ROLE_GRANTS.ADMIN, NAVIGATION_PERMISSIONS.adminUsers, NAVIGATION_PERMISSIONS.adminOrganization, NAVIGATION_PERMISSIONS.adminAudit];
  const later = ["forecast", "procurement", "vendors", "projects", "cash", "knowledge"];

  it("keeps all authorized menus visible and disables exactly the six later workspaces", () => {
    const items = visibleCpeNavigation(permissions).flatMap(group => group.items);
    expect(items.filter(item => item.disabledReason).map(item => item.href)).toEqual(later.map(screen => `/cpe/${screen}`));
    expect(items.filter(item => item.href.startsWith("/cpe/") && !item.disabledReason).map(item => item.href))
      .toEqual(["/cpe/exec", "/cpe/sales", "/cpe/estimate", "/cpe/costcheck", "/cpe/bidsim", "/cpe/catalog"]);
    const adminItems = items.filter(item => item.href.startsWith("/admin/"));
    expect(adminItems.map(item => item.href)).toEqual(["/admin/users", "/admin/organization", "/admin/audit"]);
    expect(adminItems.every(item => !item.disabledReason)).toBe(true);
    expect(PROCESS.filter(([, screen]) => isPhase1Screen(screen))).toHaveLength(5);
  });

  it("excludes later routes from command search, favorites/recents and quick create", () => {
    const destinations = enabledCpeNavigation(permissions).flatMap(group => group.items.map(item => item.href));
    for (const screen of later) expect(destinations).not.toContain(`/cpe/${screen}`);
    expect(visibleCpeQuickCreate(permissions).map(item => item.href)).toEqual(["/cpe/sales?create=1", "/cpe/catalog?create=1"]);
  });

  it("preserves permission checks even for Phase 1 destinations", () => {
    expect(visibleCpeNavigation([])).toEqual([]);
    expect(enabledCpeNavigation([])).toEqual([]);
    expect(visibleCpeQuickCreate([])).toEqual([]);
    expect(enabledCpeNavigation(["cpe.sales.view"]).flatMap(group => group.items.map(item => item.href))).toEqual(["/cpe/sales"]);
    expect(visibleCpeQuickCreate(["cpe.sales.view"])).toEqual([]);
    expect(enabledCpeNavigation(CPE_ROLE_GRANTS.PROJECT_MANAGER)).toEqual([]);
  });

  it("renders unavailable links without a destination or keyboard activation", () => {
    const html = renderToStaticMarkup(createElement(CpeNavigationLink, {
      href: "/cpe/projects", disabledReason: LATER_PHASE_MESSAGE, title: "โครงการ",
    }, "โครงการ"));
    expect(html).toContain('role="link" aria-disabled="true"');
    expect(html).toContain(LATER_PHASE_MESSAGE);
    expect(html).not.toMatch(/href=|tabindex=|<a\b/i);
    const active = renderToStaticMarkup(createElement(CpeNavigationLink, { href: "/cpe/sales" }, "โอกาสขาย"));
    expect(active).toContain('href="/cpe/sales"');
    expect(active).not.toContain('aria-disabled');
  });
});
