import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { COMPANY } from "../../lib/company-profile";

describe("verified CP Engineering company identity", () => {
  it("provides usable public contact links and the three reference business areas", () => {
    expect(new URL(COMPANY.website).hostname).toBe("cpe.cpcrts.com");
    expect(COMPANY.name).toBe("บริษัท เจริญโภคภัณฑ์วิศวกรรม จำกัด");
    expect(COMPANY.founded).toBe(1978);
    expect(COMPANY.businesses.map(b => b.english)).toEqual([
      "Seeds & Grains Processing", "Engineering & Construction", "Renewable Energy",
    ]);
    expect(COMPANY.phoneLink.replace("tel:+66", "0")).toBe(COMPANY.phone.replaceAll("-", ""));
    expect(COMPANY.email).toBe("info@cpe.co.th");
  });

  it("preserves the official company logo byte-for-byte", () => {
    const bytes = readFileSync(`public${COMPANY.logo}`);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe("8f84f2d5445579420daf8369fb91d40dfb177d23928574bbe80e2d963ca419d5");
  });
});
