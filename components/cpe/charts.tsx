import type { ReactNode } from "react";
export function LineChart({
  series,
  labels,
  title,
}: {
  series: { label: string; color: string; values: (number | null)[] }[];
  labels: string[];
  title: string;
}) {
  const values = series.flatMap((s) =>
    s.values.filter((v): v is number => v !== null && Number.isFinite(v)),
  );
  if (!values.length)
    return <p className="cpe-empty">ยังไม่มีข้อมูลสำหรับกราฟ{title}</p>;
  const min = Math.min(0, ...values),
    max = Math.max(1, ...values),
    span = max - min || 1;
  const point = (v: number, i: number) =>
    `${45 + (i * 600) / Math.max(1, labels.length - 1)},${190 - ((v - min) / span) * 160}`;
  return (
    <figure className="cpe-chart">
      <svg viewBox="0 0 680 230" role="img" aria-label={title}>
        <title>{title}</title>
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i}>
            <line
              x1="45"
              x2="645"
              y1={30 + i * 40}
              y2={30 + i * 40}
              stroke="var(--cpe-line)"
            />
            <text
              x="40"
              y={34 + i * 40}
              textAnchor="end"
              fontSize="16"
              fill="currentColor"
            >
              {new Intl.NumberFormat("th-TH", { notation: "compact" }).format(
                max - (i * span) / 4,
              )}
            </text>
          </g>
        ))}
        {series.map((s) => (
          <g key={s.label}>
            {s.values.map((v, i) =>
              v !== null && i > 0 && s.values[i - 1] !== null ? (
                <polyline
                  key={i}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="2.5"
                  points={`${point(s.values[i - 1]!, i - 1)} ${point(v, i)}`}
                />
              ) : null,
            )}
            {s.values.map((v, i) =>
              v === null ? null : (
                <circle
                  key={i}
                  cx={45 + (i * 600) / Math.max(1, labels.length - 1)}
                  cy={190 - ((v - min) / span) * 160}
                  r="3"
                  fill={s.color}
                >
                  <title>
                    {`${s.label}: ${labels[i]} ${v.toLocaleString("th-TH")}`}
                  </title>
                </circle>
              ),
            )}
          </g>
        ))}
        {labels.map((l, i) =>
          labels.length < 9 || i % Math.ceil(labels.length / 8) === 0 ? (
            <text
              key={i}
              x={45 + (i * 600) / Math.max(1, labels.length - 1)}
              y="215"
              textAnchor="middle"
              fontSize="16"
              fill="currentColor"
            >
              <title>{l}</title>
              {/^(\d{4})-(\d{2})$/.test(l) ? `${l.slice(5)}/${l.slice(2, 4)}` : l}
            </text>
          ) : null,
        )}
      </svg>
      <figcaption>
        {series.map((s) => (
          <span key={s.label}>
            <i style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
export function BarList({
  rows,
}: {
  rows: { label: string; value: number; detail?: ReactNode }[];
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="cpe-bars">
      {rows.map((r, i) => (
        <div key={`${r.label}-${i}`}>
          <span>{r.label}</span>
          <strong>{r.detail ?? r.value.toLocaleString("th-TH")}</strong>
          <div>
            <i style={{ width: `${Math.max(0, (r.value / max) * 100)}%` }} />
          </div>
        </div>
      ))}
      {!rows.length && <p className="cpe-empty">ยังไม่มีข้อมูล</p>}
    </div>
  );
}
export function Scatter({
  points,
}: {
  points: { label: string; x: number; y: number; won: boolean }[];
}) {
  if (!points.length) return <p className="cpe-empty">ยังไม่มีประวัติประมูล</p>;
  const maxX = Math.max(1, ...points.map((p) => p.x)),
    maxY = Math.max(1, ...points.map((p) => p.y));
  return (
    <figure className="cpe-chart">
      <svg
        viewBox="0 0 680 220"
        role="img"
        aria-label="ราคาต่อหน่วยเทียบกำไรของงานชนะและแพ้"
      >
        <title>ประวัติราคาต่อหน่วยและกำไร</title>
        <path d="M40 10V190H650" fill="none" stroke="currentColor" />
        {points.map((p, i) => (
          <circle
            key={i}
            cx={40 + (p.x / maxX) * 600}
            cy={190 - (p.y / maxY) * 170}
            r="5"
            fill={p.won ? "#2c8461" : "#b8443a"}
          >
            <title>
              {`${p.label} · ${p.won ? "ชนะ" : "แพ้"} · ${p.x.toLocaleString("th-TH")} บาท/หน่วย · กำไร ${p.y}%`}
            </title>
          </circle>
        ))}
        <text
          x="330"
          y="215"
          textAnchor="middle"
          fill="currentColor"
          fontSize="16"
        >
          ราคาเสนอต่อหน่วย (บาท)
        </text>
      </svg>
      <figcaption>แกนตั้ง: % กำไร · สีเขียว: ชนะ · สีแดง: แพ้</figcaption>
    </figure>
  );
}
