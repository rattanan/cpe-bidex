import Link from "next/link";
import { ArrowUpRight, Building2, Factory, Leaf, Mail, MapPin, Phone, Sprout } from "lucide-react";
import { COMPANY } from "../lib/company-profile";
import { CompanyBrand } from "./company-brand";

export function CompanyIntro() {
  return (
    <section className="company-welcome" aria-label="CP Engineering workspace">
      <div className="company-welcome-icon"><Building2 aria-hidden="true" /></div>
      <div><p className="company-eyebrow">ENGINEERING A SUSTAINABLE FUTURE</p><strong>{COMPANY.name}</strong><p>เชื่อมความเชี่ยวชาญด้านวิศวกรรม สู่การตัดสินใจที่มั่นใจในทุกโครงการ</p></div>
      <Link href="/company">รู้จักบริษัท <ArrowUpRight size={18} aria-hidden="true" /></Link>
    </section>
  );
}

export function CompanyProfile() {
  const icons = [Sprout, Factory, Leaf];
  return (
    <div className="company-profile">
      <section className="company-hero">
        <div className="company-hero-copy">
          <p className="company-eyebrow">ABOUT CP ENGINEERING</p>
          <h1>วิศวกรรมที่สร้างคุณค่า<br /><span>เพื่ออนาคตที่ยั่งยืน</span></h1>
          <p className="company-legal-name">{COMPANY.name}</p>
          <p>{COMPANY.englishName}</p>
          <p className="company-description">{COMPANY.description}</p>
          <a className="company-website-link" href={COMPANY.website} target="_blank" rel="noopener noreferrer">เยี่ยมชมเว็บไซต์บริษัท <ArrowUpRight size={19} aria-hidden="true" /></a>
        </div>
        <div className="company-hero-identity"><CompanyBrand /><div className="company-founded"><span>ก่อตั้งเมื่อปี ค.ศ.</span><strong>{COMPANY.founded}</strong><span>ความเชี่ยวชาญที่ส่งต่อสู่ทุกโครงการ</span></div></div>
      </section>
      <section className="company-section" aria-labelledby="company-business-title">
        <p className="company-eyebrow">OUR EXPERTISE</p><h2 id="company-business-title">3 ธุรกิจหลัก เชื่อมความเชี่ยวชาญเป็นหนึ่งเดียว</h2>
        <div className="company-business-grid">{COMPANY.businesses.map((business, i) => { const Icon = icons[i]; return <article className="company-business" key={business.english}><span className="company-service-icon"><Icon aria-hidden="true" /></span><span className="company-service-number">0{i + 1}</span><h3>{business.title}</h3><p className="company-business-english">{business.english}</p><p>{business.description}</p></article>; })}</div>
      </section>
      <div className="company-purpose-grid"><section className="company-purpose"><p className="company-eyebrow">OUR VISION</p><h2>วิสัยทัศน์</h2><p>{COMPANY.vision}</p></section><section className="company-purpose"><p className="company-eyebrow">OUR MISSION</p><h2>พันธกิจ</h2><p>{COMPANY.mission}</p></section></div>
      <section className="company-contact" aria-labelledby="company-contact-title">
        <div><p className="company-eyebrow">GET IN TOUCH</p><h2 id="company-contact-title">ติดต่อ CP Engineering</h2><p>{COMPANY.name}</p></div>
        <address><a href={COMPANY.map} target="_blank" rel="noopener noreferrer"><MapPin aria-hidden="true" /><span>{COMPANY.address}</span></a><a href={COMPANY.phoneLink}><Phone aria-hidden="true" /><span>{COMPANY.phone}</span></a><a href={`mailto:${COMPANY.email}`}><Mail aria-hidden="true" /><span>{COMPANY.email}</span></a></address>
      </section>
      <p className="company-source">ข้อมูลบริษัทจาก <a href={COMPANY.website} target="_blank" rel="noopener noreferrer">เว็บไซต์ CP Engineering</a> · ตรวจสอบเมื่อ 5 พฤศจิกายน 2569</p>
    </div>
  );
}
