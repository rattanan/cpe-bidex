import Link from "next/link";

export function pageNumberItems(page: number, totalPages: number): Array<number | "ellipsis"> {
  const pages = new Set([1, totalPages, page - 2, page - 1, page, page + 1, page + 2]);
  const values = [...pages].filter((value) => value >= 1 && value <= totalPages).sort((left, right) => left - right);
  const result: Array<number | "ellipsis"> = [];
  for (const value of values) {
    const previous = result.at(-1);
    if (typeof previous === "number" && value - previous > 1) result.push("ellipsis");
    result.push(value);
  }
  return result;
}

type Props = {
  ariaLabel: string;
  basePath: string;
  itemCount: number;
  page: number;
  params?: Record<string, string>;
  total: number;
  totalPages: number;
  unit: string;
  previousLabel?: string;
  nextLabel?: string;
};

export function PageNumberNavigation({ ariaLabel, basePath, itemCount, page, params = {}, total, totalPages, unit, previousLabel = "Prev", nextLabel = "Next" }: Props) {
  const href = (target: number) => {
    const search = new URLSearchParams(params);
    if (target > 1) search.set("page", String(target)); else search.delete("page");
    const query = search.toString();
    return query ? `${basePath}?${query}` : basePath;
  };
  return <nav className="card-body table-pagination" aria-label={ariaLabel}>
    <span>หน้า {page} / {totalPages} · แสดง {itemCount.toLocaleString("th-TH")} จาก {total.toLocaleString("th-TH")} {unit}</span>
    <div className="page-number-list">
      {page > 1
        ? <Link className="page-number page-direction" href={href(page - 1)} rel="prev" aria-label="หน้าก่อนหน้า">{previousLabel}</Link>
        : <span className="page-number page-direction is-disabled" aria-disabled="true">{previousLabel}</span>}
      {pageNumberItems(page, totalPages).map((item, index) => item === "ellipsis"
        ? <span className="page-ellipsis" aria-hidden="true" key={`ellipsis-${index}`}>…</span>
        : item === page
          ? <span className="page-number is-current" aria-current="page" key={item}>{item}</span>
          : <Link className="page-number" href={href(item)} aria-label={`หน้า ${item}`} key={item}>{item}</Link>)}
      {page < totalPages
        ? <Link className="page-number page-direction" href={href(page + 1)} rel="next" aria-label="หน้าถัดไป">{nextLabel}</Link>
        : <span className="page-number page-direction is-disabled" aria-disabled="true">{nextLabel}</span>}
    </div>
  </nav>;
}
