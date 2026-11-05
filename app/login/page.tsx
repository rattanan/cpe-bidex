import { ArrowUpRight, CheckCircle2, Leaf } from "lucide-react";
import { LoginForm } from "@/components/forms";
import { CompanyBrand } from "@/components/company-brand";
import { COMPANY } from "@/lib/company-profile";

export default function LoginPage() {
  return (
    <main className="login cpe-login">
      <div className="login-layout">
        <section className="login-showcase" aria-label="CPE Project Bid Excellence">
          <CompanyBrand />
          <div className="login-intro">
            <p className="company-eyebrow">PROJECT BID EXCELLENCE</p>
            <h2>ทุกต้นทุนชัดเจน<br />ทุกโครงการ<span>มั่นใจ</span></h2>
            <p className="login-description">เชื่อมงานขาย ประมาณราคา จัดซื้อ และบริหารโครงการ<br className="login-desktop-break" /> เพื่อส่งมอบงานวิศวกรรมอย่างมีประสิทธิภาพ</p>
            <div className="login-workflow"><span><CheckCircle2 aria-hidden="true" /> ต้นทุนแม่นยำ</span><span><CheckCircle2 aria-hidden="true" /> ข้อมูลเชื่อมถึงกัน</span><span><Leaf aria-hidden="true" /> เติบโตอย่างยั่งยืน</span></div>
          </div>
          <div className="login-company-info"><strong>{COMPANY.name}</strong><p>{COMPANY.englishName}</p><div className="login-company-facts"><span>ก่อตั้งปี <strong>{COMPANY.founded}</strong></span><span>3 ธุรกิจหลัก</span><span>วิศวกรรมครบวงจร</span></div><a href={COMPANY.website} target="_blank" rel="noopener noreferrer">รู้จัก CP Engineering <ArrowUpRight size={18} aria-hidden="true" /></a></div>
        </section>
        <section className="login-card" aria-labelledby="login-title">
          <div className="login-heading"><p className="eyebrow">WELCOME TO YOUR WORKSPACE</p><h1 id="login-title">ยินดีต้อนรับกลับ</h1><p>เข้าสู่ระบบเพื่อจัดการงานและโครงการของคุณ</p></div>
          <LoginForm />
          <div className="login-support"><span className="login-support-line" /><p>Project Bid Excellence</p><span>ระบบบริหารต้นทุนและจัดซื้อเชิงรุก</span><a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a></div>
        </section>
      </div>
      <footer className="login-company-footer"><span>{COMPANY.shortName} · Engineering a sustainable future</span><span>{COMPANY.phone} <span aria-hidden="true">|</span> {COMPANY.email}</span></footer>
    </main>
  );
}
