import {
  Building2,
  ChartNoAxesCombined,
  ClipboardList,
  Database,
  FileCheck2,
  FolderKanban,
  Gauge,
  Layers,
  Library,
  ListTree,
  Settings,
  ShoppingCart,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { SCREENS, isPhase1Screen, LATER_PHASE_MESSAGE, type Screen } from "../../lib/cpe/config";
import type { NavGroup } from "../app-navigation";
import { NAV_GROUPS as LEGACY_GROUPS } from "../app-navigation";
const ICONS = {
  exec: Gauge,
  sales: ChartNoAxesCombined,
  estimate: ListTree,
  costcheck: FileCheck2,
  bidsim: TrendingUp,
  catalog: Database,
  forecast: TrendingUp,
  procurement: ShoppingCart,
  vendors: Users,
  projects: FolderKanban,
  cash: Wallet,
  knowledge: Library,
} satisfies Record<Screen, typeof Gauge>;
export const CPE_NAV_GROUPS: NavGroup[] = [
  ...new Set(SCREENS.map((s) => s.group)),
].map((label) => ({
  label,
  icon: Layers,
  items: SCREENS.filter((s) => s.group === label).map((s) => ({
    label: s.label,
    href: `/cpe/${s.id}`,
    icon: ICONS[s.id],
    requiredPermission: s.permission,
    disabledReason: isPhase1Screen(s.id) ? undefined : LATER_PHASE_MESSAGE,
  })),
}));
CPE_NAV_GROUPS.push({
  label: "ผู้ดูแลระบบ",
  icon: Settings,
  items: LEGACY_GROUPS.flatMap((g) => g.items).filter((i) =>
    ["/admin/users", "/admin/organization", "/admin/audit"].includes(i.href),
  ),
});
export function visibleCpeNavigation(permissions: readonly string[]) {
  return CPE_NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter(
      (i) => i.requiredPermission && permissions.includes(i.requiredPermission),
    ),
  })).filter((g) => g.items.length);
}
export function enabledCpeNavigation(permissions: readonly string[]) {
  return visibleCpeNavigation(permissions).map(group => ({
    ...group, items: group.items.filter(item => !item.disabledReason),
  })).filter(group => group.items.length);
}
export function cpeNavigationLabel(pathname: string) {
  return (
    CPE_NAV_GROUPS.flatMap((g) => g.items)
      .filter((i) => pathname === i.href || pathname.startsWith(`${i.href}/`))
      .sort((a, b) => b.href.length - a.href.length)[0]?.label ??
    "CPE Project Bid Excellence"
  );
}
export const CPE_QUICK_CREATE = [
  {
    label: "รับงานใหม่",
    screen: "sales",
    href: "/cpe/sales?create=1",
    requiredPermission: "cpe.sales.manage",
  },
  {
    label: "เพิ่มฐานต้นทุน",
    screen: "catalog",
    href: "/cpe/catalog?create=1",
    requiredPermission: "cpe.catalog.manage",
  },
  {
    label: "เพิ่มผู้รับเหมา",
    screen: "vendors",
    href: "/cpe/vendors?create=1",
    requiredPermission: "cpe.vendors.manage",
  },
] satisfies { label: string; screen: Screen; href: string; requiredPermission: string }[];
export function visibleCpeQuickCreate(permissions: readonly string[]) {
  return CPE_QUICK_CREATE.filter(item => isPhase1Screen(item.screen) && permissions.includes(item.requiredPermission));
}
export const cpeNavigationIcons = { Building2, ClipboardList };
