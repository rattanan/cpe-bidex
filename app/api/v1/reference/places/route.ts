import { NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth";

const querySchema = z.string().trim().min(2).max(200);
const resultSchema = z.array(z.object({
  place_id: z.union([z.number(), z.string()]),
  display_name: z.string(),
  lat: z.string(),
  lon: z.string(),
})).max(5);

type Place = { id: string; label: string; latitude: number; longitude: number };
type CachedPlaces = { expiresAt: number; places: Place[] };

const cache = new Map<string, CachedPlaces>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 200;
const MIN_UPSTREAM_INTERVAL_MS = 1_100;
let nextUpstreamRequestAt = 0;

function cached(key: string) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.places;
}

function store(key: string, places: Place[]) {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, places });
}

export async function GET(request: Request) {
  if (!await getSession()) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Authentication required" } }, { status: 401 });
  }
  const parsed = querySchema.safeParse(new URL(request.url).searchParams.get("q") ?? "");
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "VALIDATION_FAILED", message: "กรุณาระบุชื่อสถานที่อย่างน้อย 2 ตัวอักษร" } }, { status: 400 });
  }
  const key = parsed.data.toLocaleLowerCase("th-TH");
  const hit = cached(key);
  if (hit) return NextResponse.json({ data: hit }, { headers: { "cache-control": "private, max-age=300" } });

  const now = Date.now();
  if (now < nextUpstreamRequestAt) {
    return NextResponse.json({ error: { code: "RATE_LIMITED", message: "กรุณารอสักครู่ก่อนค้นหาอีกครั้ง" } }, { status: 429, headers: { "retry-after": "1" } });
  }
  nextUpstreamRequestAt = now + MIN_UPSTREAM_INTERVAL_MS;

  const baseUrl = process.env.OPENSTREETMAP_NOMINATIM_BASE_URL || "https://nominatim.openstreetmap.org";
  const validatedBaseUrl = z.string().url().refine((value) => new URL(value).protocol === "https:").safeParse(baseUrl);
  if (!validatedBaseUrl.success) {
    return NextResponse.json({ error: { code: "GEOCODING_CONFIGURATION_INVALID", message: "บริการค้นหาสถานที่ยังไม่ได้ตั้งค่า" } }, { status: 503 });
  }
  const url = new URL("search", `${validatedBaseUrl.data.replace(/\/$/, "")}/`);
  url.search = new URLSearchParams({ q: parsed.data, format: "jsonv2", limit: "5", addressdetails: "0" }).toString();

  try {
    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        "accept-language": "th,en;q=0.8",
        "user-agent": process.env.OPENSTREETMAP_APP_USER_AGENT || "CPE-BidEx/0.1.1",
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`Nominatim returned ${response.status}`);
    const upstream = resultSchema.parse(await response.json());
    const places = upstream.flatMap((item) => {
      const latitude = Number(item.lat), longitude = Number(item.lon);
      return Number.isFinite(latitude) && Number.isFinite(longitude)
        ? [{ id: String(item.place_id), label: item.display_name, latitude, longitude }]
        : [];
    });
    store(key, places);
    return NextResponse.json({ data: places }, { headers: { "cache-control": "private, max-age=300" } });
  } catch {
    return NextResponse.json({ error: { code: "GEOCODING_UNAVAILABLE", message: "บริการค้นหาสถานที่ไม่พร้อมใช้งาน กรุณากรอกพิกัดด้วยตนเอง" } }, { status: 503 });
  }
}
