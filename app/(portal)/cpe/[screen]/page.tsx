import { notFound } from "next/navigation";
import { CpeWorkspace } from "@/components/cpe/workspace";
import { cpeActor, CpeError } from "@/lib/cpe/access";
import { SCREENS } from "@/lib/cpe/config";
import {
  loadCpePage,
  parseCpeFilters,
  type CpePageData,
} from "@/lib/cpe/query";
export default async function CpePage({
  params,
  searchParams,
}: {
  params: Promise<{ screen: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { screen } = await params;
  const definition = SCREENS.find((s) => s.id === screen);
  if (!definition) notFound();
  let data: CpePageData | null = null;
  let message = "";
  try {
    data = await loadCpePage(
      await cpeActor(),
      definition.id,
      parseCpeFilters(await searchParams),
    );
  } catch (error) {
    if (error instanceof CpeError) {
      if (error.status === 404) notFound();
      message = error.message;
    } else throw error;
  }
  if (!data)
    return (
      <section className="card card-body" role="alert">
        <h1>ไม่มีสิทธิ์เข้าถึงหน้านี้</h1>
        <p>{message}</p>
      </section>
    );
  return (
    <CpeWorkspace
      key={`${screen}:${data.filters.organizationId}:${data.filters.id}:${data.filters.page}`}
      data={data}
    />
  );
}
