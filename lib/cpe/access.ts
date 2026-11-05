import type { Prisma } from "@prisma/client";
import { requireSession } from "../auth";
import { prisma } from "../prisma";
import {
  authorizedOrganizationUnitIds,
  expandOrganizationScopeIds,
  loadAuthorizationContext,
  loadGrantedPermissions,
} from "../authorization/authorization-context";
export class CpeError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export type CpeActor = {
  id: string;
  name: string;
  organizationIds: string[];
  permissions: string[];
  permissionsByOrganization?: Record<string, string[]>;
  broadOrganizationsByPermission?: Record<string, string[]>;
};
export function assertCpePermission(
  actor: CpeActor,
  permission: string,
  organizationId?: string,
) {
  const grants =
    organizationId && actor.permissionsByOrganization
      ? (actor.permissionsByOrganization[organizationId] ?? [])
      : actor.permissions;
  if (!grants.includes(permission))
    throw new CpeError("ไม่มีสิทธิ์ดำเนินการ", 403);
}
export function assertCpeOrganization(actor: CpeActor, organizationId: string) {
  if (!actor.organizationIds.includes(organizationId))
    throw new CpeError("ไม่พบข้อมูลในขอบเขตที่ได้รับสิทธิ์", 404);
}
export function cpeOpportunityScope(
  actor: CpeActor,
  permission: string,
  organizationIds: readonly string[],
): Prisma.CpeOpportunityWhereInput {
  if (!actor.broadOrganizationsByPermission)
    return { organizationUnitId: { in: [...organizationIds] } };
  const broad = actor.broadOrganizationsByPermission[permission] ?? [];
  return {
    organizationUnitId: { in: [...organizationIds] },
    OR: [
      { organizationUnitId: { in: broad } },
      { ownerId: actor.id },
      { estimatorId: actor.id },
      { project: { pmId: actor.id } },
    ],
  };
}
export function cpeFinanceScope(
  actor: CpeActor,
  permission: string,
  organizationIds: readonly string[],
): Prisma.CpeFinanceEntryWhereInput {
  const organizationUnitId = { in: [...organizationIds] };
  if (!actor.broadOrganizationsByPermission) return { organizationUnitId };
  return {
    organizationUnitId,
    OR: [
      {
        organizationUnitId: {
          in: actor.broadOrganizationsByPermission[permission] ?? [],
        },
      },
      { createdById: actor.id },
      {
        project: {
          opportunity: cpeOpportunityScope(actor, permission, organizationIds),
        },
      },
    ],
  };
}
export async function cpeActor(): Promise<CpeActor> {
  const session = await requireSession();
  const context = await loadAuthorizationContext({
    actorId: session.id,
    legacyRole: session.role,
  });
  const [permissions, grants, units] = await Promise.all([
    loadGrantedPermissions(context),
    prisma.rolePermissionGrant.findMany({
      where: { roleCode: { in: context.assignments.map((a) => a.role) } },
      select: { roleCode: true, permissionCode: true },
    }),
    prisma.organizationUnit.findMany({
      where: { active: true },
      select: { id: true, parentId: true },
    }),
  ]);
  const permissionsByOrganization: Record<string, string[]> = {},
    broadOrganizationsByPermission: Record<string, string[]> = {};
  for (const assignment of context.assignments) {
    if (!assignment.organizationUnitId) continue;
    const ids = expandOrganizationScopeIds(
      [assignment.organizationUnitId],
      units,
    );
    const codes = grants
      .filter((g) => g.roleCode === assignment.role)
      .map((g) => g.permissionCode);
    for (const org of ids)
      permissionsByOrganization[org] = [
        ...new Set([...(permissionsByOrganization[org] ?? []), ...codes]),
      ];
    if (!["SELF", "ASSIGNED_TASK"].includes(assignment.scope))
      for (const code of codes)
        broadOrganizationsByPermission[code] = [
          ...new Set([...(broadOrganizationsByPermission[code] ?? []), ...ids]),
        ];
  }
  return {
    id: session.id,
    name: session.name,
    organizationIds: authorizedOrganizationUnitIds(context),
    permissions,
    permissionsByOrganization,
    broadOrganizationsByPermission,
  };
}
