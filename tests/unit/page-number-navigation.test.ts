import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { pageNumberItems } from "../../components/page-number-navigation";

describe("pageNumberItems", () => {
  it("shows every page when the result set is small", () => {
    expect(pageNumberItems(2, 3)).toEqual([1, 2, 3]);
  });

  it("keeps first, nearby and last pages while condensing a large result set", () => {
    expect(pageNumberItems(8, 20)).toEqual([1, "ellipsis", 6, 7, 8, 9, 10, "ellipsis", 20]);
  });
});

describe("PageNumberNavigation contract", () => {
  const source = readFileSync(join(process.cwd(), "components/page-number-navigation.tsx"), "utf8");

  it("always renders consistent Prev and Next controls with disabled states", () => {
    expect(source).toContain('aria-disabled="true">{previousLabel}</span>');
    expect(source).toContain('aria-disabled="true">{nextLabel}</span>');
    expect(source).toContain('previousLabel = "Prev"');
    expect(source).toContain('nextLabel = "Next"');
    expect(source).toContain('rel="prev"');
    expect(source).toContain('rel="next"');
  });

  it("is shared by every paginated table page", () => {
    for (const path of ["app/(portal)/leads/page.tsx", "app/(portal)/products/page.tsx", "app/(portal)/prospects/page.tsx"]) {
      expect(readFileSync(join(process.cwd(), path), "utf8")).toContain("<PageNumberNavigation");
    }
  });
});
