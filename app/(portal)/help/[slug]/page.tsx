import Link from "next/link";
import { notFound } from "next/navigation";
import { getHelpArticle, getRelatedHelpArticles, helpAudienceLabels } from "@/lib/help-center";

export default async function HelpArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const article = getHelpArticle((await params).slug);
  if (!article) notFound();
  const related = getRelatedHelpArticles(article);
  return <>
    {article.legacy && <div className="cpe-note" role="note">บทความนี้เป็นคู่มือระบบเดิม · <Link href="/help">เปิดคู่มือ CPE Bidex ปัจจุบัน</Link></div>}
    <div className="help-article-head">
      <Link href="/help">← กลับศูนย์ช่วยเหลือ CPE Bidex</Link>
      <div><span className="badge">{article.category}</span><small>{article.readingMinutes} นาที · อัปเดต {article.updatedAt}</small></div>
      <h1>{article.title}</h1><p>{article.summary}</p>
      <div className="help-audiences">{article.audience.map((role) => <span key={role}>{helpAudienceLabels[role]}</span>)}</div>
    </div>
    <div className="help-article-layout">
      <article className="card help-article"><div className="card-body">
        {article.sections.map((section, index) => <section id={`section-${index + 1}`} key={section.title}><h2>{section.title}</h2>{section.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</section>)}
        <section className="help-faq" id="faq"><h2>คำถามที่พบบ่อย</h2>{article.faqs.map((faq) => <details key={faq.question}><summary>{faq.question}<span aria-hidden="true">+</span></summary><p>{faq.answer}</p></details>)}</section>
      </div></article>
      <aside>
        {article.workspaceHref && <section className="card"><div className="card-body"><h2>เริ่มทำงาน</h2><p>เปิดหน้าที่เกี่ยวข้องตามสิทธิ์ของบัญชี</p><Link className="primary" href={article.workspaceHref}>ไปยังหน้าทำงาน →</Link></div></section>}
        <nav className="card help-toc" aria-label="สารบัญบทความ"><div className="card-body"><h2>ในบทความนี้</h2>{article.sections.map((section, index) => <a key={section.title} href={`#section-${index + 1}`}>{section.title}</a>)}<a href="#faq">คำถามที่พบบ่อย</a></div></nav>
        {related.length > 0 && <section className="card related-help"><div className="card-body"><h2>บทความที่เกี่ยวข้อง</h2>{related.map((item) => <Link href={`/help/${item.slug}`} key={item.slug}><strong>{item.title}</strong><small>{item.summary}</small></Link>)}</div></section>}
      </aside>
    </div>
  </>;
}
