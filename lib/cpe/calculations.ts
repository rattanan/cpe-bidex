import { Prisma } from "@prisma/client";
import type { Master } from "./config";
export const D = (value: Prisma.Decimal.Value) => new Prisma.Decimal(value);
export const sum = (values: Prisma.Decimal.Value[]) =>
  values.reduce<Prisma.Decimal>((total, value) => total.add(value), D(0));
export const money = (value: Prisma.Decimal.Value) => {
  const result = D(value).toDecimalPlaces(4);
  if (!result.isFinite() || result.abs().gte("1000000000000000"))
    throw new RangeError("จำนวนเงินเกินขอบเขตที่รองรับ");
  return result;
};
export function bidPrice(
  cost: Prisma.Decimal.Value,
  margin: Prisma.Decimal.Value,
) {
  if (D(cost).lte(0) || D(margin).lt(0) || D(margin).gte(100))
    throw new Error("ต้นทุนหรือกำไรไม่ถูกต้อง");
  return money(D(cost).div(D(1).sub(D(margin).div(100))));
}
export function boqCost(
  items: {
    quantity: Prisma.Decimal.Value;
    material: Prisma.Decimal.Value;
    labor: Prisma.Decimal.Value;
  }[],
  policy: { overhead: number; risk: number },
) {
  return money(
    sum(items.map((i) => D(i.quantity).mul(D(i.material).add(i.labor)))).mul(
      D(1).add(D(policy.overhead).add(policy.risk).div(100)),
    ),
  );
}
export function weightedVendorScore(
  scores: Record<string, number>,
  master: Master,
) {
  for (const dimension of master.dimensions)
    if (
      !Number.isFinite(scores[dimension.key]) ||
      scores[dimension.key] < 0 ||
      scores[dimension.key] > 100
    )
      throw new Error("คะแนนต้องอยู่ในช่วง 0–100");
  const score = sum(
    master.dimensions.map((d) => D(scores[d.key]).mul(d.weight).div(100)),
  );
  const grade = [...master.grades]
    .sort((a, b) => b.minimum - a.minimum)
    .find((g) => score.gte(g.minimum))?.name;
  if (!grade) throw new Error("ยังไม่ได้กำหนดเกณฑ์เกรด");
  return { score: money(score), grade };
}
export function costBand(
  value: Prisma.Decimal.Value,
  reference: Prisma.Decimal.Value,
  tolerance: number,
) {
  if (D(reference).lte(0)) return { deviation: null, label: "ไม่มีค่าอ้างอิง" };
  const deviation = D(value).sub(reference).div(reference).mul(100);
  return {
    deviation: deviation.toFixed(2),
    label: deviation.gt(tolerance)
      ? "สูงกว่าอ้างอิง"
      : deviation.lt(-tolerance)
        ? "ต่ำผิดปกติ"
        : "อยู่ในกรอบ",
  };
}
export type BidHistory = { margin: Prisma.Decimal.Value; won: boolean };
// Probability is unavailable without observed outcomes; no invented history or confidence.
export type WinModel = {
  count: number;
  wins: number;
  winningAverage: number | null;
  losingAverage: number | null;
};
export function winProbability(
  margin: number,
  history: BidHistory[] | WinModel,
  adjustment: number,
  policy: Master["bidding"] = {
    probabilityCap: 85,
    slope: 2.2,
    defaultPivot: 15,
  },
): number | null {
  const average = (rows: BidHistory[]) =>
    rows.length
      ? rows.reduce((s, h) => s + Number(h.margin), 0) / rows.length
      : null;
  const model: WinModel = Array.isArray(history)
    ? {
        count: history.length,
        wins: history.filter((h) => h.won).length,
        winningAverage: average(history.filter((h) => h.won)),
        losingAverage: average(history.filter((h) => !h.won)),
      }
    : history;
  if (!model.count) return null;
  const pivot =
    (model.winningAverage !== null && model.losingAverage !== null
      ? (model.winningAverage + model.losingAverage) / 2
      : policy.defaultPivot) + adjustment;
  return (
    policy.probabilityCap / (1 + Math.exp((margin - pivot) / policy.slope))
  );
}
export function sCurve(months: number) {
  if (!Number.isInteger(months) || months < 1 || months > 120)
    throw new Error("ระยะเวลาต้องอยู่ในช่วง 1–120 เดือน");
  return Array.from({ length: months }, (_, i) => {
    const t = D(i + 1).div(months);
    return t
      .mul(t)
      .mul(D(3).sub(t.mul(2)))
      .mul(100)
      .toDecimalPlaces(4)
      .toString();
  });
}
export function monthDate(start: Date, index: number) {
  const result = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + index, 1),
  );
  return result;
}
export function scaleQuantity(
  quantity: Prisma.Decimal.Value,
  oldSize: Prisma.Decimal.Value,
  newSize: Prisma.Decimal.Value,
  oldUnit: string,
  newUnit: string,
) {
  if (oldUnit !== newUnit || D(oldSize).lte(0) || D(newSize).lte(0))
    throw new Error("คัดลอกตามสัดส่วนได้เมื่อหน่วยขนาดงานตรงกันเท่านั้น");
  return money(D(quantity).mul(newSize).div(oldSize));
}
