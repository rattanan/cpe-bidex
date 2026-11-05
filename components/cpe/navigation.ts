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
import { SCREENS, type Screen } from "../../lib/cpe/config";
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
    href: "/cpe/sales?create=1",
    requiredPermission: "cpe.sales.manage",
  },
  {
    label: "เพิ่มฐานต้นทุน",
    href: "/cpe/catalog?create=1",
    requiredPermission: "cpe.catalog.manage",
  },
  {
    label: "เพิ่มผู้รับเหมา",
    href: "/cpe/vendors?create=1",
    requiredPermission: "cpe.vendors.manage",
  },
];
export const cpeNavigationIcons = { Building2, ClipboardList };
