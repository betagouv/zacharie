import { UserRelationType } from '@prisma/client';
import type { User } from '@prisma/client';
import prisma from '~/prisma';

export async function isAllowedPremierDetenteurUserId(
  value: string | null | undefined,
  currentValues: Array<string | null | undefined>,
  user: User
): Promise<boolean> {
  if (!value) return true;
  if (value === user.id) return true;
  if (currentValues.includes(value)) return true;
  const relation = await prisma.userRelations.findFirst({
    where: { owner_id: user.id, related_id: value, relation: UserRelationType.PREMIER_DETENTEUR },
    select: { id: true },
  });
  return !!relation;
}
