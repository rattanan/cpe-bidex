import Image from "next/image";
import { COMPANY } from "../lib/company-profile";

export function CompanyBrand({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`company-brand ${compact ? "compact" : ""}`}>
      <span className="company-logo-surface">
        <Image src={COMPANY.logo} alt={`ตราสัญลักษณ์ ${COMPANY.name}`} width={350} height={263} priority />
      </span>
      <span className="company-brand-copy">
        <strong>CP ENGINEERING</strong>
        <small>Project Bid Excellence</small>
      </span>
    </span>
  );
}
