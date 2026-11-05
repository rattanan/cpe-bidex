"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Clock3, Search, Star, X } from "lucide-react";

import { visibleCpeNavigation as visibleNavigation } from "@/components/cpe/navigation";

const FAVORITES_KEY = "ntop-favorite-routes";
const RECENTS_KEY = "ntop-recent-routes";

function readRoutes(key: string) {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function EnterpriseCommandPalette({
  open,
  onOpenChange,
  grantedPermissions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  grantedPermissions: readonly string[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recents, setRecents] = useState<string[]>([]);
  const items = useMemo(
    () => visibleNavigation(grantedPermissions).flatMap((group) => group.items.map((item) => ({ ...item, group: group.label }))),
    [grantedPermissions],
  );

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setFavorites(readRoutes(FAVORITES_KEY));
      const knownRoute = items.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
      const nextRecents = knownRoute
        ? [knownRoute.href, ...readRoutes(RECENTS_KEY).filter((href) => href !== knownRoute.href)].slice(0, 6)
        : readRoutes(RECENTS_KEY);
      setRecents(nextRecents);
      localStorage.setItem(RECENTS_KEY, JSON.stringify(nextRecents));
    });
    return () => cancelAnimationFrame(frame);
  }, [items, pathname]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange(!open);
      }
      if (event.key === "Escape" && open) onOpenChange(false);
      if (event.key === "Tab" && open && dialogRef.current) {
        const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled])')];
        const first = focusable[0];
        const last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onOpenChange, open]);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      setQuery("");
      setActiveIndex(0);
      inputRef.current?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  const normalized = query.trim().toLocaleLowerCase("th");
  const filtered = items
    .filter((item) => `${item.label} ${item.keywords ?? ""} ${item.group}`.toLocaleLowerCase("th").includes(normalized))
    .sort((a, b) => {
      const score = (href: string) => (favorites.includes(href) ? 2 : 0) + (recents.includes(href) ? 1 : 0);
      return score(b.href) - score(a.href);
    });

  const goTo = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  const toggleFavorite = (href: string) => {
    const next = favorites.includes(href) ? favorites.filter((item) => item !== href) : [href, ...favorites];
    setFavorites(next);
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
  };

  if (!open) return null;

  return (
    <div className="command-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onOpenChange(false)}>
      <section ref={dialogRef} className="command-dialog" role="dialog" aria-modal="true" aria-labelledby="command-title">
        <div className="command-search">
          <Search aria-hidden="true" />
          <label className="sr-only" htmlFor="global-command-search">ค้นหาเมนูและคำสั่ง</label>
          <input
            ref={inputRef}
            id="global-command-search"
            value={query}
            onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") { event.preventDefault(); setActiveIndex((index) => Math.min(index + 1, filtered.length - 1)); }
              if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((index) => Math.max(index - 1, 0)); }
              if (event.key === "Enter" && filtered[activeIndex]) { event.preventDefault(); goTo(filtered[activeIndex].href); }
            }}
            placeholder="ค้นหาโอกาสขาย BOQ จัดซื้อ หรือหน้าที่ต้องการ…"
            autoComplete="off"
            role="combobox"
            aria-expanded="true"
            aria-controls="command-results"
          />
          <kbd>ESC</kbd>
          <button className="command-close" type="button" onClick={() => onOpenChange(false)} aria-label="ปิดหน้าต่างคำสั่ง"><X /></button>
        </div>
        <div className="command-heading">
          <div><span className="eyebrow">GLOBAL NAVIGATION</span><h2 id="command-title">ไปที่หน้าที่ต้องการ</h2></div>
          <span>{filtered.length} รายการ</span>
        </div>
        <div className="command-results" id="command-results" role="list" aria-label="ผลการค้นหา">
          {filtered.map((item, index) => {
            const Icon = item.icon;
            const favorite = favorites.includes(item.href);
            const recent = recents.includes(item.href);
            return (
              <div className={`command-result ${activeIndex === index ? "active" : ""}`} key={item.href} role="listitem">
                <button type="button" className="command-result-main" onMouseEnter={() => setActiveIndex(index)} onClick={() => goTo(item.href)}>
                  <span className="command-result-icon"><Icon /></span>
                  <span><strong>{item.label}</strong><small>{item.group}{recent ? " · ใช้ล่าสุด" : ""}</small></span>
                  {recent && <Clock3 className="command-recent" aria-label="ใช้ล่าสุด" />}
                </button>
                <button type="button" className={`command-favorite ${favorite ? "selected" : ""}`} onClick={() => toggleFavorite(item.href)} aria-label={`${favorite ? "นำออกจาก" : "เพิ่มใน"}รายการโปรด ${item.label}`}><Star /></button>
              </div>
            );
          })}
          {!filtered.length && <div className="command-empty"><Search /><strong>ไม่พบหน้าที่ค้นหา</strong><p>ลองค้นหาโอกาสขาย ต้นทุน หรือโครงการ</p></div>}
        </div>
        <footer className="command-footer"><span><kbd>↑</kbd><kbd>↓</kbd> เลือก</span><span><kbd>ENTER</kbd> เปิด</span><Link href="/cpe/knowledge" onClick={() => onOpenChange(false)}>คลังข้อมูล</Link></footer>
      </section>
    </div>
  );
}
