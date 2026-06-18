import { CarcasseModificationRequest, CarcasseModificationRequestStatus } from '@prisma/client';

// The active (open) modif request for a carcasse — at most one exists at a time, creation is blocked
// while one is pending. Derived from the full-history array stored by carcasse id.
export function getPendingModifRequest(
  requests: Array<CarcasseModificationRequest> | undefined
): CarcasseModificationRequest | null {
  return (
    requests?.find((r) => r.status === CarcasseModificationRequestStatus.PENDING && !r.deleted_at) ?? null
  );
}
