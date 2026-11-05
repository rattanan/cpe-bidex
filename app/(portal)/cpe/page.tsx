import { redirect } from "next/navigation";
import { cpeActor } from "@/lib/cpe/access";
import { SCREENS } from "@/lib/cpe/config";
export default async function CpeHome() {
  const actor = await cpeActor();
  const first = SCREENS.find((s) => actor.permissions.includes(s.permission));
  if (first) redirect(`/cpe/${first.id}`);
  return (
    <section className="card card-body">
      <h1>CPE Project Bid Excellence</h1>
      <p>บัญชีนี้ยังไม่มีสิทธิ์ CPE กรุณาให้ผู้ดูแลระบบกำหนดบทบาทและหน่วยงาน</p>
    </section>
  );
}
