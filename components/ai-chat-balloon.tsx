"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, BookOpen, MessageCircle, Send, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { PageAssistantSource } from "@/lib/ai/page-assistant-service";
import { PRODUCT } from "@/lib/company-profile";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  localOnly?: boolean;
  sources?: PageAssistantSource[];
};

const quickQuestions = ["สรุปข้อมูลหน้านี้", "มีสิ่งที่ต้องติดตามไหม", "หน้านี้ใช้งานอย่างไร"] as const;

function normalizeVisiblePageText(value: string) {
  return value.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, 16_000);
}

function welcomeMessage(pageLabel: string): ChatMessage {
  return {
    id: "welcome",
    role: "assistant",
    localOnly: true,
    content: `สวัสดีครับ ผมช่วยสรุปข้อมูลในหน้า${pageLabel ? ` “${pageLabel}”` : "นี้"} ตอบคำถามจากสิ่งที่แสดง และแนะนำวิธีใช้งานจาก Help Center ได้`,
  };
}

function visiblePageContext(pageLabel: string) {
  const main = document.querySelector<HTMLElement>("#main-content");
  const heading = main?.querySelector<HTMLElement>("h1")?.innerText.trim();
  return {
    pageTitle: heading || pageLabel || document.title,
    pageContent: normalizeVisiblePageText(main?.innerText || heading || pageLabel || "หน้าปัจจุบัน"),
  };
}

function errorMessage(status: number) {
  if (status === 401) return "Session หมดอายุ กรุณาเข้าสู่ระบบใหม่";
  if (status === 400) return "ไม่สามารถส่งคำถามนี้ได้ กรุณาตรวจว่าไม่มีรหัสผ่านหรือข้อมูลลับ แล้วลองใหม่";
  if (status === 503) return "AI ยังไม่พร้อมใช้งานในขณะนี้ คุณยังใช้งานส่วนอื่นของระบบได้ตามปกติ";
  return "เกิดข้อผิดพลาดในการตอบคำถาม กรุณาลองใหม่อีกครั้ง";
}

export function AiChatBalloon({ pageLabel }: { pageLabel: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(() => [welcomeMessage(pageLabel)]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [messages, loading]);

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const ask = async (nextQuestion: string) => {
    const trimmed = nextQuestion.trim();
    if (!trimmed || loading) return;
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", content: trimmed };
    const history = messages.filter((message) => !message.localOnly).slice(-8).map(({ role, content }) => ({ role, content }));
    setMessages((value) => [...value, userMessage]);
    setQuestion("");
    setError("");
    setLoading(true);
    try {
      const context = visiblePageContext(pageLabel);
      const response = await fetch("/api/v1/ai/page-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed, pathname, ...context, conversation: history }),
      });
      const payload = await response.json() as { data?: { answer?: string; sources?: PageAssistantSource[] } };
      if (!response.ok || !payload.data?.answer) throw new Error(String(response.status));
      setMessages((value) => [...value, { id: crypto.randomUUID(), role: "assistant", content: payload.data!.answer!, sources: payload.data!.sources }]);
    } catch (caught) {
      const status = caught instanceof Error ? Number(caught.message) : 0;
      setError(errorMessage(status));
    } finally {
      setLoading(false);
    }
  };

  return <div className={`ai-chat ${open ? "open" : ""}`}>
    {open && <section id="ai-chat-panel" className="ai-chat-panel" role="dialog" aria-modal="false" aria-labelledby="ai-chat-title">
      <header className="ai-chat-head">
        <span className="ai-chat-avatar"><Bot aria-hidden="true"/></span>
        <div><strong id="ai-chat-title">{PRODUCT.assistantName}</strong><small><span aria-hidden="true"/>พร้อมช่วยอ่านหน้านี้</small></div>
        <button type="button" onClick={close} aria-label="ปิด AI Assistant"><X/></button>
      </header>
      <div className="ai-chat-context"><Sparkles aria-hidden="true"/><span>กำลังอ้างอิงหน้า <strong>{pageLabel}</strong></span></div>
      <div className="ai-chat-messages" aria-live="polite" aria-busy={loading}>
        {messages.map((message) => <article className={`ai-chat-message ${message.role}`} key={message.id}>
          {message.role === "assistant" && <span className="ai-chat-message-icon"><Bot aria-hidden="true"/></span>}
          <div><p>{message.content}</p>{message.sources && message.sources.length > 0 && <div className="ai-chat-sources"><span><BookOpen aria-hidden="true"/>อ่านเพิ่มเติม</span>{message.sources.map((source) => <Link href={source.href} key={source.slug} onClick={() => setOpen(false)}>{source.title}</Link>)}</div>}</div>
        </article>)}
        {loading && <article className="ai-chat-message assistant typing"><span className="ai-chat-message-icon"><Bot aria-hidden="true"/></span><div aria-label="AI กำลังตอบ"><i/><i/><i/></div></article>}
        <div ref={messagesEndRef}/>
      </div>
      {messages.length === 1 && <div className="ai-chat-suggestions" aria-label="คำถามแนะนำ">{quickQuestions.map((item) => <button type="button" key={item} onClick={() => void ask(item)} disabled={loading}>{item}</button>)}</div>}
      {error && <p className="ai-chat-error" role="alert">{error}</p>}
      <form className="ai-chat-form" onSubmit={(event) => { event.preventDefault(); void ask(question); }}>
        <label className="sr-only" htmlFor="ai-chat-question">ถามเกี่ยวกับหน้าปัจจุบัน</label>
        <textarea id="ai-chat-question" ref={inputRef} value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void ask(question); } }} placeholder="ถามเกี่ยวกับข้อมูลหรือวิธีใช้หน้านี้…" maxLength={1_000} rows={1}/>
        <button type="submit" aria-label="ส่งคำถาม" disabled={loading || !question.trim()}><Send/></button>
      </form>
      <footer>AI อาจตอบผิดพลาด โปรดตรวจสอบข้อมูล · ไม่แก้ไขข้อมูลในระบบ</footer>
    </section>}
    <button ref={triggerRef} type="button" className="ai-chat-trigger" aria-label={open ? "ปิด AI Assistant" : "เปิด AI Assistant"} aria-expanded={open} aria-controls="ai-chat-panel" onClick={() => setOpen((value) => !value)}>
      {open ? <X aria-hidden="true"/> : <MessageCircle aria-hidden="true"/>}<span>AI</span>
    </button>
  </div>;
}
