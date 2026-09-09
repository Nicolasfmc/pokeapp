import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/database";

export async function writeAuditLog(input: {
  userId?: string | null;
  action: string;
  entity: string;
  entityId: string;
  metadata?: Prisma.InputJsonValue;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: input.userId ?? null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        metadata: input.metadata ?? undefined,
      },
    });
  } catch (error) {
    console.error(error);
  }
}
