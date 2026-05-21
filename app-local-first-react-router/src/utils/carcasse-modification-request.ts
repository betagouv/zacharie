import {
  type Carcasse,
  type CarcasseModificationRequest,
  CarcasseModificationRequestStatus,
  CarcasseModificationRequestType,
} from '@prisma/client';
import { useMemo } from 'react';
import useZustandStore from '@app/zustand/store';

// Local-first store-based workflow — no dedicated POST endpoints.
// To create a request:  useZustandStore.getState().createCarcasseModifRequest(...)
// To approve/reject:    useZustandStore.getState().updateCarcasseModifRequest(id, partial, approvalPayload?)
// The /sync pipeline then pushes the changes to the backend, which applies the authoritative side
// effects (notify examinateur on create, mutate Carcasse on approve, notify requester, etc.).
//
// This file exposes selectors + the GET hydration helper for the examinateur dashboard.

// --- Selectors -------------------------------------------------------------

export function useRequestsForCarcasse(zacharie_carcasse_id: string | undefined) {
  const byId = useZustandStore((state) => state.carcasseModifPendingRequestsIds);
  return useMemo(() => {
    if (!zacharie_carcasse_id) return [];
    return Object.values(byId)
      .filter((r) => r.zacharie_carcasse_id === zacharie_carcasse_id && !r.deleted_at)
      .sort((a, b) => new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime());
  }, [byId, zacharie_carcasse_id]);
}

export function usePendingRequestForCarcasse(zacharie_carcasse_id: string | undefined) {
  const requests = useRequestsForCarcasse(zacharie_carcasse_id);
  return useMemo(
    () => requests.find((r) => r.status === CarcasseModificationRequestStatus.PENDING) ?? null,
    [requests]
  );
}

export function useHistoryForCarcasse(zacharie_carcasse_id: string | undefined) {
  const requests = useRequestsForCarcasse(zacharie_carcasse_id);
  return useMemo(
    () => requests.filter((r) => r.status !== CarcasseModificationRequestStatus.PENDING),
    [requests]
  );
}

// Non-hook version for use inside loops / non-React contexts.
export function getPendingRequestForCarcasse(
  carcasseModifPendingRequestsIds: Record<string, CarcasseModificationRequest>,
  zacharie_carcasse_id: string
): CarcasseModificationRequest | null {
  for (const r of Object.values(carcasseModifPendingRequestsIds)) {
    if (
      r.zacharie_carcasse_id === zacharie_carcasse_id &&
      r.status === CarcasseModificationRequestStatus.PENDING &&
      !r.deleted_at
    ) {
      return r;
    }
  }
  return null;
}

export function hasPendingModifRequest(
  carcasseModifPendingRequestsIds: Record<string, CarcasseModificationRequest>,
  carcasse: Pick<Carcasse, 'zacharie_carcasse_id'>
): boolean {
  return (
    getPendingRequestForCarcasse(carcasseModifPendingRequestsIds, carcasse.zacharie_carcasse_id) !== null
  );
}

export { CarcasseModificationRequestStatus, CarcasseModificationRequestType };
