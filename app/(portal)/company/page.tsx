import type { Metadata } from "next";
import { CompanyProfile } from "@/components/company-profile";

export const metadata: Metadata = { title: "เกี่ยวกับบริษัท | CP Engineering" };

// The existing portal layout requires an authenticated session; these are public company facts.
export default function CompanyPage() {
  return <CompanyProfile />;
}
