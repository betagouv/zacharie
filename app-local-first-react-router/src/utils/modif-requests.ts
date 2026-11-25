import { CarcasseModificationRequest, CarcasseModificationRequestStatus } from '@prisma/client';

export function getPendingModifRequest(
  requests: Array<CarcasseModificationRequest> | undefined
): CarcasseModificationRequest | null {
  return (
    requests?.find((r) => r.status === CarcasseModificationRequestStatus.PENDING && !r.deleted_at) ?? null
  );
}
