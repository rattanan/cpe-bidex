import Link from "next/link";
import type { ComponentProps } from "react";

export function CpeNavigationLink({ disabledReason, children, ...props }: ComponentProps<typeof Link> & { disabledReason?: string }) {
  if (disabledReason) {
    return <span role="link" aria-disabled="true" className={props.className} title={`${props.title ? `${props.title} · ` : ""}${disabledReason}`}>
      {children}<small className="cpe-phase-label">{disabledReason}</small>
    </span>;
  }
  return <Link {...props}>{children}</Link>;
}
