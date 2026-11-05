import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { cpeActor, CpeError } from "@/lib/cpe/access";
import { executeCpeCommand } from "@/lib/cpe/service";
export async function POST(request: Request) {
  // Session cookie mutations require a same-origin request, including behind a proxy.
  const origin = request.headers.get("origin");
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  let sameOrigin = false;
  try {
    sameOrigin = !!origin && new URL(origin).host === host;
  } catch {
    sameOrigin = false;
  }
  if (!sameOrigin)
    return NextResponse.json(
      { error: "คำขอข้ามเว็บไซต์ไม่ได้รับอนุญาต" },
      { status: 403 },
    );
  if (Number(request.headers.get("content-length")) > 300000)
    return NextResponse.json(
      { error: "ข้อมูลเกินขนาดที่รองรับ" },
      { status: 413 },
    );
  try {
    const actor = await cpeActor();
    const reader = request.body?.getReader();
    if (!reader) throw new CpeError("ไม่มีข้อมูลคำสั่ง");
    const decoder = new TextDecoder();
    let bytes = 0;
    let body = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 300000) {
        await reader.cancel();
        throw new CpeError("ข้อมูลเกินขนาดที่รองรับ", 413);
      }
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
    const resultId = await executeCpeCommand(actor, JSON.parse(body));
    return NextResponse.json({ resultId });
  } catch (error) {
    if (error instanceof ZodError)
      return NextResponse.json(
        { error: error.issues.map((i) => i.message).join(" · ") },
        { status: 400 },
      );
    if (error instanceof CpeError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    if (error instanceof SyntaxError)
      return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
    if (error instanceof RangeError)
      return NextResponse.json({ error: error.message }, { status: 400 });
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      ["P2002", "P2034"].includes(error.code)
    )
      return NextResponse.json(
        { error: "ข้อมูลซ้ำหรือถูกแก้ไขพร้อมกัน กรุณาโหลดใหม่แล้วลองอีกครั้ง" },
        { status: 409 },
      );
    // Next navigation signals must propagate (e.g. expired authentication).
    if (error && typeof error === "object" && "digest" in error) throw error;
    return NextResponse.json(
      { error: "บันทึกไม่สำเร็จ กรุณาลองใหม่หรือติดต่อผู้ดูแลระบบ" },
      { status: 500 },
    );
  }
}
