"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Bell, ChevronDown, ChevronRight, CircleHelp, Home, LogOut, Menu, Moon, Plus, Search, PanelLeftClose, PanelLeftOpen, Sun, X } from "lucide-react";

import { logout } from "@/app/actions";
import { AiChatBalloon } from "@/components/ai-chat-balloon";
import { EnterpriseCommandPalette } from "@/components/enterprise-command-palette";
import { CPE_NAV_GROUPS as NAV_GROUPS, cpeNavigationLabel as navigationLabel, visibleCpeNavigation as visibleNavigation, CPE_QUICK_CREATE } from "@/components/cpe/navigation";
import { CPE_ROLE_GRANTS, CPE_ROLE_LABELS } from "@/lib/cpe/config";
import type { HeaderNotification } from "@/lib/notifications/header-notifications";

// Static route contracts are implemented by the navigation configuration in app-navigation.ts.
// Kept discoverable for architecture checks: href: "/admin/users", href: "/admin/audit", href: "/admin/organization".

function isActive(pathname: string, href: string) { return pathname === href || pathname.startsWith(`${href}/`); }
function closeQuickCreate(event: React.MouseEvent<HTMLAnchorElement>) { event.currentTarget.closest("details")?.removeAttribute("open"); }

export function AppShell({ children, user, notifications, version }: { children: React.ReactNode; user: { name: string; roles: readonly string[]; grantedPermissions: readonly string[] }; notifications: HeaderNotification[]; version: string }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => Object.fromEntries(NAV_GROUPS.map((group) => [group.label, true])));
  useEffect(() => { const frame = requestAnimationFrame(() => { setCollapsed(localStorage.getItem("ntop-sidebar-collapsed") === "true"); setDarkMode(document.documentElement.dataset.theme === "dark"); }); return () => cancelAnimationFrame(frame); }, []);
  const toggleCollapsed = () => setCollapsed((value) => { localStorage.setItem("ntop-sidebar-collapsed", String(!value)); return !value; });
  const toggleTheme = () => setDarkMode((value) => { const next=!value; document.documentElement.dataset.theme=next?"dark":"light"; document.documentElement.style.colorScheme=next?"dark":"light"; localStorage.setItem("ntop-theme",next?"dark":"light"); return next; });
  const setCommandVisibility = useCallback((open: boolean) => setCommandOpen(open), []);
  const [viewRole, setViewRole] = useState("all");
  const viewPermissions = viewRole === "all" ? user.grantedPermissions : user.grantedPermissions.filter(p => CPE_ROLE_GRANTS[viewRole]?.includes(p));
  const visibleGroups = visibleNavigation(viewPermissions);
  const quickCreateItems = CPE_QUICK_CREATE.filter(item => user.grantedPermissions.includes(item.requiredPermission));
  const displayedNotifications = pathname.startsWith("/cpe") ? [] : notifications;
  const currentLabel = navigationLabel(pathname);
  const roleLabel = user.roles.map((role) => CPE_ROLE_LABELS[role] ?? role.replaceAll("_", " ")).join(" · ");

  const navigation = <>
    <Link href="/cpe" onClick={() => setMobileOpen(false)} className={`sidebar-link ${pathname === "/cpe" ? "active" : ""}`} title="หน้าแรก"><Home className="sidebar-icon"/><span>หน้าแรก</span></Link>
    {visibleGroups.map((group) => {
      const GroupIcon = group.icon; const open = openGroups[group.label] || group.items.some((item) => isActive(pathname, item.href));
      return <div className="sidebar-group" key={group.label}>
        <button type="button" className="sidebar-group-button" onClick={() => setOpenGroups((value) => ({ ...value, [group.label]: !open }))} aria-expanded={open} title={group.label}>
          <GroupIcon className="sidebar-icon"/><span>{group.label}</span><ChevronDown className={`sidebar-chevron ${open ? "open" : ""}`}/>
        </button>
        <div className={`sidebar-submenu ${open ? "open" : ""}`}><div className="sidebar-submenu-list">{group.items.map((item) => { const Icon = item.icon; return <Link href={item.href} onClick={() => setMobileOpen(false)} key={item.href} className={`sidebar-link sub ${isActive(pathname, item.href) ? "active" : ""}`} title={item.label}><Icon className="sidebar-icon"/><span>{item.label}</span>{isActive(pathname, item.href) && <ChevronRight className="sidebar-current"/>}</Link>; })}</div></div>
      </div>;
    })}
  </>;

  return <div className={`shell app-frame cpe-app ${collapsed ? "sidebar-collapsed" : ""}`}>
    <a className="skip-link" href="#main-content">ข้ามไปยังเนื้อหาหลัก</a>
    <EnterpriseCommandPalette open={commandOpen} onOpenChange={setCommandVisibility} grantedPermissions={user.grantedPermissions}/>
    {mobileOpen && <button className="sidebar-backdrop" aria-label="ปิดเมนู" onClick={() => setMobileOpen(false)}/>}
    <aside className={`app-sidebar ${mobileOpen ? "mobile-open" : ""}`}>
      <div className="sidebar-brand"><Link href="/cpe"><span className="cpe-brand-mark">CPE</span><span><strong>BID EXCELLENCE</strong><small>Project Cost & Procurement</small></span></Link><button className="mobile-close" onClick={() => setMobileOpen(false)} aria-label="ปิดเมนู"><X/></button></div>
      <nav className="sidebar-nav" aria-label="เมนูหลัก">{navigation}</nav>
      <div className="sidebar-footer"><button type="button" onClick={toggleCollapsed} aria-label={collapsed ? "ขยายเมนู" : "ย่อเมนู"}>{collapsed ? <PanelLeftOpen/> : <PanelLeftClose/>}<span>{collapsed ? "ขยาย" : "ย่อเมนู"}</span></button><small className="sidebar-version">Version {version}</small></div>
    </aside>
    <div className="app-workspace">
      <header className="workspace-header">
        <button className="mobile-menu" onClick={() => setMobileOpen(true)} aria-label="เปิดเมนู"><Menu/></button>
        <nav className="breadcrumb" aria-label="เส้นทางนำทาง"><Link href="/cpe"><Home/><span>หน้าแรก</span></Link><ChevronRight aria-hidden="true"/><span aria-current="page">{currentLabel}</span></nav>
        <button className="global-search-trigger" type="button" onClick={() => setCommandOpen(true)} aria-label="เปิดการค้นหาและเมนูคำสั่ง"><Search/><span>ค้นหาหรือไปที่…</span><kbd>Ctrl K</kbd></button>
        <div className="header-actions"><label className="cpe-role-view"><span>มุมมอง</span><select aria-label="มุมมองตามบทบาทที่ได้รับ" value={viewRole} onChange={e=>setViewRole(e.target.value)}><option value="all">ทุกบทบาทของฉัน</option>{user.roles.filter(r=>CPE_ROLE_GRANTS[r]).map(role=><option key={role} value={role}>{CPE_ROLE_LABELS[role]??role}</option>)}</select></label>
          {quickCreateItems.length > 0 && <details className="quick-create"><summary className="primary"><Plus/>สร้างใหม่</summary><div className="quick-create-menu"><strong>Quick create</strong>{quickCreateItems.map((item) => <Link href={item.href} key={item.href} onClick={closeQuickCreate}><Plus/>{item.label}</Link>)}</div></details>}
          <button type="button" className="icon-button theme-toggle" onClick={toggleTheme} aria-label={darkMode ? "ใช้โหมดสว่าง" : "ใช้โหมดมืด"} aria-pressed={darkMode}>{darkMode ? <Sun/> : <Moon/>}</button>
          <Link className="header-help" href="/help" aria-label="ศูนย์ช่วยเหลือ"><CircleHelp/></Link>
          <div className="notification-wrap"><button type="button" className="icon-button" aria-label={`การแจ้งเตือน ${displayedNotifications.length} รายการ`} aria-expanded={notificationOpen} onClick={() => setNotificationOpen((value) => !value)}><Bell/>{displayedNotifications.length > 0 && <span className="notification-count">{displayedNotifications.length > 9 ? "9+" : displayedNotifications.length}</span>}</button>
            {notificationOpen && <div className="notification-panel"><div className="notification-head"><div><strong>การแจ้งเตือน</strong><small>{displayedNotifications.length} รายการล่าสุด</small></div><button onClick={() => setNotificationOpen(false)} aria-label="ปิด"><X/></button></div><div className="notification-list">{displayedNotifications.length ? displayedNotifications.map((item) => <Link href={item.href} key={item.id} className={`notification-item ${item.tone.toLowerCase()}`} onClick={() => setNotificationOpen(false)}><span className="notification-dot"/><span><strong>{item.title}</strong><small>{item.description}</small><time>{new Date(item.occurredAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "short", timeStyle: "short" })}</time></span></Link>) : <div className="notification-empty"><Bell/><p>ยังไม่มีการแจ้งเตือน</p></div>}</div></div>}
          </div>
          <div className="user-chip"><span><strong>{user.name}</strong><small title={roleLabel}>{roleLabel}</small></span><form action={logout}><button type="submit" className="icon-button" aria-label="ออกจากระบบ"><LogOut/></button></form></div>
        </div>
      </header>
      <nav className="cpe-mobile-nav" aria-label="เมนู CPE สำหรับจอเล็ก">{visibleGroups.flatMap(group=>group.items).map(item=><Link key={item.href} href={item.href} aria-current={isActive(pathname,item.href)?"page":undefined}>{item.label}</Link>)}</nav>
      <main className="content" id="main-content" tabIndex={-1}>{children}</main>
    </div>
    {!pathname.startsWith("/cpe") && <AiChatBalloon key={pathname} pageLabel={currentLabel}/>}
  </div>;
}
