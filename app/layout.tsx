import type { Metadata } from "next";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import "@/components/cpe/cpe.css";
import "@/components/company-brand.css";

export const metadata: Metadata = { title: "CP Engineering | Project Bid Excellence", description: "บริษัท เจริญโภคภัณฑ์วิศวกรรม จำกัด — ระบบบริหารต้นทุนและจัดซื้อเชิงรุกสำหรับงานวิศวกรรมและก่อสร้าง", icons: { icon: "/brand/cp-engineering-logo.png", apple: "/brand/cp-engineering-logo.png" } };
const themeBoot = `(function(){try{var t=localStorage.getItem('ntop-theme');var d=t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';document.documentElement.style.colorScheme=d?'dark':'light'}catch(e){}})()`;
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="th" suppressHydrationWarning data-scroll-behavior="smooth"><head><script dangerouslySetInnerHTML={{ __html: themeBoot }}/></head><body>{children}</body></html>; }
