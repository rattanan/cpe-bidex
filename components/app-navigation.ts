import type { ComponentType } from "react";
import {
  Activity,
  ArchiveRestore,
  Boxes,
  Building2,
  FileCheck2,
  FileText,
  Gauge,
  Handshake,
  History,
  LayoutDashboard,
  PackageSearch,
  Settings,
  ShieldCheck,
  DraftingCompass,
  MapPinned,
  ListTree,
  Target,
  Users,
} from "lucide-react";

import { NAVIGATION_PERMISSIONS, QUICK_CREATE_PERMISSIONS } from "../lib/authorization/navigation-permissions";

export type NavItem = {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  keywords?: string;
  requiredPermission?: string;
  disabledReason?: string;
};

export type NavGroup = {
  label: string;
  icon: ComponentType<{ className?: string }>;
  items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "งานขาย",
    icon: Handshake,
    items: [
      { label: "Prospect", href: "/prospects", icon: PackageSearch, keywords: "ผู้มุ่งหวัง", requiredPermission: NAVIGATION_PERMISSIONS.prospects },
      { label: "Lead", href: "/leads", icon: Target, keywords: "ลูกค้าเป้าหมาย", requiredPermission: NAVIGATION_PERMISSIONS.leads },
      { label: "Customer", href: "/customers", icon: Users, keywords: "customer account", requiredPermission: NAVIGATION_PERMISSIONS.customers },
      { label: "โอกาสขาย", href: "/opportunities", icon: Gauge, keywords: "opportunity deal", requiredPermission: NAVIGATION_PERMISSIONS.opportunities },
      { label: "กิจกรรม", href: "/activities", icon: Activity, keywords: "meeting task", requiredPermission: NAVIGATION_PERMISSIONS.activities },
    ],
  },
  {
    label: "Commercial",
    icon: FileCheck2,
    items: [
      { label: "Sales Pipeline", href: "/pipeline", icon: LayoutDashboard, requiredPermission: NAVIGATION_PERMISSIONS.pipeline },
      { label: "Coverage", href: "/coverage", icon: PackageSearch, requiredPermission: NAVIGATION_PERMISSIONS.coverage },
      { label: "Solution Design", href: "/solution-designs", icon: DraftingCompass, keywords: "presales solution", requiredPermission: NAVIGATION_PERMISSIONS.solutionDesigns },
      { label: "Site Survey", href: "/site-surveys", icon: MapPinned, keywords: "survey ntsp", requiredPermission: NAVIGATION_PERMISSIONS.siteSurveys },
      { label: "BOQ", href: "/boqs", icon: ListTree, keywords: "bill of quantities", requiredPermission: NAVIGATION_PERMISSIONS.boqs },
      { label: "บริการและราคา", href: "/products", icon: Boxes, keywords: "product service", requiredPermission: NAVIGATION_PERMISSIONS.products },
      { label: "Proposal", href: "/proposals", icon: FileCheck2, keywords: "proposal quotation ai", requiredPermission: NAVIGATION_PERMISSIONS.proposals },
      { label: "Quotation", href: "/quotes", icon: FileText, keywords: "quote quotation ใบเสนอราคา", requiredPermission: NAVIGATION_PERMISSIONS.quotes },
      { label: "สัญญา", href: "/contracts", icon: FileCheck2, keywords: "contract agreement renewal", requiredPermission: NAVIGATION_PERMISSIONS.contracts },
      { label: "การอนุมัติ", href: "/approvals", icon: ShieldCheck, keywords: "approval", requiredPermission: NAVIGATION_PERMISSIONS.approvals },
    ],
  },
  {
    label: "ผู้ดูแลระบบ",
    icon: Settings,
    items: [
      { label: "Users & Roles", href: "/admin/users", icon: Users, requiredPermission: NAVIGATION_PERMISSIONS.adminUsers },
      { label: "Organization", href: "/admin/organization", icon: Building2, requiredPermission: NAVIGATION_PERMISSIONS.adminOrganization },
      { label: "Login & Audit Log", href: "/admin/audit", icon: History, requiredPermission: NAVIGATION_PERMISSIONS.adminAudit },
      { label: "Deleted Records", href: "/admin/deleted-records", icon: ArchiveRestore, requiredPermission: NAVIGATION_PERMISSIONS.adminDeletedRecords },
      { label: "AI Settings", href: "/admin/ai-settings", icon: Settings, requiredPermission: NAVIGATION_PERMISSIONS.adminAiSettings },
      { label: "Risk Rules", href: "/admin/ai-risk", icon: Gauge, requiredPermission: NAVIGATION_PERMISSIONS.adminRiskRules },
      { label: "Approval Control Center", href: "/admin/workflow", icon: ShieldCheck, requiredPermission: NAVIGATION_PERMISSIONS.adminWorkflow },
      { label: "Lead Assignment Rules", href: "/admin/lead-management", icon: Target, requiredPermission: NAVIGATION_PERMISSIONS.adminLeadManagement },
      { label: "Service Categories", href: "/admin/service-categories", icon: ListTree, keywords: "product catalog category", requiredPermission: NAVIGATION_PERMISSIONS.adminServiceCategories },
      { label: "Solution Reference Data", href: "/admin/solution-reference-data", icon: ListTree, keywords: "solution component risk category", requiredPermission: NAVIGATION_PERMISSIONS.adminServiceCategories },
    ],
  },
];

export const QUICK_CREATE_ITEMS = [
  { label: "สร้าง Prospect", href: "/prospects/new", requiredPermission: QUICK_CREATE_PERMISSIONS.prospect },
  { label: "สร้าง Lead", href: "/leads/new", requiredPermission: QUICK_CREATE_PERMISSIONS.lead },
  { label: "สร้าง Customer", href: "/customers/new", requiredPermission: QUICK_CREATE_PERMISSIONS.customer },
  { label: "สร้างโอกาสขาย", href: "/opportunities/new", requiredPermission: QUICK_CREATE_PERMISSIONS.opportunity },
  { label: "บันทึกกิจกรรม", href: "/activities/new", requiredPermission: QUICK_CREATE_PERMISSIONS.activity },
  { label: "สร้างเอกสารข้อเสนอ (Proposal)", href: "/proposals/new", requiredPermission: QUICK_CREATE_PERMISSIONS.proposal },
  { label: "สร้างใบเสนอราคา (Quotation)", href: "/quotes/new", requiredPermission: QUICK_CREATE_PERMISSIONS.quote },
  { label: "สร้างสัญญา", href: "/contracts/new", requiredPermission: QUICK_CREATE_PERMISSIONS.contract },
];

export function visibleNavigation(grantedPermissions: readonly string[]) {
  const granted = new Set(grantedPermissions);
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.requiredPermission || granted.has(item.requiredPermission)),
  })).filter((group) => group.items.length > 0);
}

export function visibleQuickCreate(grantedPermissions: readonly string[]) {
  const granted = new Set(grantedPermissions);
  return QUICK_CREATE_ITEMS.filter((item) => granted.has(item.requiredPermission));
}

export function navigationLabel(pathname: string) {
  const candidates = NAV_GROUPS.flatMap((group) => group.items)
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length);
  return candidates[0]?.label ?? "หน้าหลัก";
}
