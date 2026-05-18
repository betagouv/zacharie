import {
  type Carcasse,
  type CarcasseModificationRequest,
  CarcasseModificationRequestStatus,
  CarcasseModificationRequestType,
} from '@prisma/client';
import { useMemo } from 'react';
import useZustandStore from '@app/zustand/store';
import API from '@app/services/api';
import type { CarcasseModificationRequestsForExaminateurResponse } from '@api/src/types/responses';

// Local-first store-based workflow — no dedicated POST endpoints.
// To create a request:  useZustandStore.getState().createCarcasseModifRequest(...)
// To approve/reject:    useZustandStore.getState().updateCarcasseModifRequest(id, partial, approvalPayload?)
// The /sync pipeline then pushes the changes to the backend, which applies the authoritative side
// effects (notify examinateur on create, mutate Carcasse on approve, notify requester, etc.).
//
// This file exposes selectors + the GET hydration helper for the examinateur dashboard.

// --- Selectors -------------------------------------------------------------

export function useRequestsForCarcasse(zacharie_carcasse_id: string | undefined) {
  const byId = useZustandStore((state) => state.carcasseModifRequestsById);
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
  carcasseModifRequestsById: Record<string, CarcasseModificationRequest>,
  zacharie_carcasse_id: string
): CarcasseModificationRequest | null {
  for (const r of Object.values(carcasseModifRequestsById)) {
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
  carcasseModifRequestsById: Record<string, CarcasseModificationRequest>,
  carcasse: Pick<Carcasse, 'zacharie_carcasse_id'>
): boolean {
  return getPendingRequestForCarcasse(carcasseModifRequestsById, carcasse.zacharie_carcasse_id) !== null;
}

// --- Dashboard hydration ---------------------------------------------------

// Fetch the PENDING requests where the current user is the examinateur initial. Used by the dashboard
// (the user might not have recently opened the underlying FEI, so the store could be cold for those).
export async function fetchModifRequestsForExaminateur() {
  const res = (await API.get({
    path: '/carcasse-modification-request/for-examinateur',
  })) as CarcasseModificationRequestsForExaminateurResponse;
  if (!res.ok || !res.data) {
    return { ok: false as const, error: res.error || 'Erreur inconnue' };
  }
  const state = useZustandStore.getState();
  const next = { ...state.carcasseModifRequestsById };
  for (const r of res.data.requests) {
    const existing = next[r.id];
    if (!existing || existing.is_synced) {
      // Only overwrite synced rows — never trample unsynced local edits.
      next[r.id] = r;
    }
  }
  useZustandStore.setState({ ...state, carcasseModifRequestsById: next });
  return { ok: true as const, data: res.data };
}

export { CarcasseModificationRequestStatus, CarcasseModificationRequestType };
