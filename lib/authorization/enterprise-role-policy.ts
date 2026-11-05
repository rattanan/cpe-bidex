import type { Role } from "@prisma/client";

export const ENTERPRISE_ROLES = [
  "ADMIN",
  "SYSTEM_ADMIN",
  "EXECUTIVE",
  "ESTIMATOR",
  "PROCUREMENT",
  "PROJECT_MANAGER",
  "SALES_DIRECTOR",
  "TEAM_MANAGER",
  "KAM",
  "PRESALES",
  "SOLUTION_ARCHITECT",
  "MARKETING",
  "COVERAGE",
  "PRICING_APPROVER",
  "LEGAL",
  "ORDER_OPERATIONS",
  "CUSTOMER_SUCCESS",
  "VIEWER",
  "AUDITOR",
  "CUSTOMER_DATA_OWNER",
  "DATA_STEWARD",
  "COMMERCIAL_COMMITTEE",
] as const;

export const AUTHORIZATION_SCOPES = [
  "SELF",
  "TEAM",
  "ORG_UNIT",
  "ENTERPRISE",
  "ASSIGNED_TASK",
  "AUDIT_READ",
] as const;

export type EnterpriseRole = (typeof ENTERPRISE_ROLES)[number];
export type AuthorizationScope = (typeof AUTHORIZATION_SCOPES)[number];

export type EffectiveRoleAssignment = {
  role: EnterpriseRole;
  scope: AuthorizationScope;
  organizationUnitId: string | null;
};

export function legacyRoleAssignment(role: Role): EffectiveRoleAssignment {
  if (role === "ADMIN") {
    return { role: "ADMIN", scope: "ENTERPRISE", organizationUnitId: null };
  }
  if (role === "VIEWER") {
    return { role: "VIEWER", scope: "SELF", organizationUnitId: null };
  }
  return { role: "KAM", scope: "SELF", organizationUnitId: null };
}

export function isEnterpriseRole(value: string): value is EnterpriseRole {
  return (ENTERPRISE_ROLES as readonly string[]).includes(value);
}

export function isAuthorizationScope(
  value: string,
): value is AuthorizationScope {
  return (AUTHORIZATION_SCOPES as readonly string[]).includes(value);
}
