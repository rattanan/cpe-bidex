import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("login page branding", () => {
  it("renders the accessible CPE identity while preserving authentication", () => {
    const page = read("app/login/page.tsx");

    expect(page).toContain('className="login-cpe-mark"');
    expect(page).toContain("CPE Project Bid Excellence");
    expect(page).toContain("Project Bid Excellence");
    expect(page).not.toContain("/ntop-logo.svg");
    expect(page).toContain('className="login-network"');
    expect(page).toContain('className="login-showcase"');
    expect(page).toContain('aria-labelledby="login-title"');
    expect(page).toContain("<LoginForm />");
  });

  it("keeps the original NT logo asset unchanged", () => {
    const logo = readFileSync(join(process.cwd(), "public/nt-logo.png"));
    const digest = createHash("sha256").update(logo).digest("hex");

    expect(digest).toBe("541dffa755947bd4291c69c418ee72ad299385251900a2781475792e453b9208");
  });

  it("keeps the login identity responsive and theme-aware", () => {
    const css = read("app/globals.css");

    expect(css).toContain(".login-showcase-lockup img { display:block;width:100%;height:auto;object-fit:contain;");
    expect(css).toContain(".login-network-lines path");
    expect(css).toContain("font-size:clamp(54px,6.3vw,92px)");
    expect(css).toContain("min-height:48px");
    expect(css).toContain("@media (max-width:1050px)");
    expect(css).toContain("@media (max-width:560px) { .login");
  });
});
