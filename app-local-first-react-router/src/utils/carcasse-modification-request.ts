import {
  type Carcasse,
  type CarcasseModificationRequest,
  CarcasseModificationRequestStatus,
  CarcasseModificationRequestType,
} from '@prisma/client';
import { useMemo } from 'react';
import useZustandStore from '@app/zustand/store';
import API from '@app/services/api';
import type {
  CarcasseModificationRequestResponse,
  CarcasseModificationRequestsForExaminateurResponse,
} from '@api/src/types/responses';

// --- Selectors / hooks -----------------------------------------------------

export function useRequestsForCarcasse(zacharie_carcasse_id: string | undefined) {
  const byId = useZustandStore((state) => state.carcasseModificationRequestsById);
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
  carcasseModificationRequestsById: Record<string, CarcasseModificationRequest>,
  zacharie_carcasse_id: string
): CarcasseModificationRequest | null {
  for (const r of Object.values(carcasseModificationRequestsById)) {
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

export function hasPendingModificationRequest(
  carcasseModificationRequestsById: Record<string, CarcasseModificationRequest>,
  carcasse: Pick<Carcasse, 'zacharie_carcasse_id'>
): boolean {
  return getPendingRequestForCarcasse(carcasseModificationRequestsById, carcasse.zacharie_carcasse_id) !== null;
}

// --- API helpers -----------------------------------------------------------

type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function postAndStore(
  path: string,
  body: Record<string, unknown>
): Promise<ApiResult<{ request: CarcasseModificationRequest; carcasse?: Carcasse }>> {
  const res = (await API.post({ path, body })) as CarcasseModificationRequestResponse;
  if (!res.ok || !res.data) {
    return { ok: false, error: res.error || 'Erreur inconnue' };
  }
  const state = useZustandStore.getState();
  state.upsertCarcasseModificationRequest(res.data.request);
  if (res.data.carcasse) {
    useZustandStore.setState((s) => ({
      ...s,
      carcasses: { ...s.carcasses, [res.data!.carcasse!.zacharie_carcasse_id]: res.data!.carcasse! },
    }));
  }
  return { ok: true, data: { request: res.data.request, carcasse: res.data.carcasse } };
}

export async function requestBraceletRename(args: {
  zacharie_carcasse_id: string;
  numero_bracelet_after: string;
  comment_intermediaire?: string;
  requested_by_entity_id: string;
}) {
  return postAndStore('/carcasse-modification-request/rename', args);
}

export async function requestNewCarcasse(args: {
  fei_numero: string;
  zacharie_carcasse_id: string;
  carcasse: Partial<Carcasse>;
  comment_intermediaire?: string;
  requested_by_entity_id: string;
}) {
  return postAndStore('/carcasse-modification-request/new', args as unknown as Record<string, unknown>);
}

export async function approveModificationRequest(
  id: string,
  examinateurFields?: {
    examinateur_anomalies_carcasse?: string[];
    examinateur_anomalies_abats?: string[];
    examinateur_commentaire?: string;
    examinateur_carcasse_sans_anomalie?: boolean;
    examinateur_approbation_mise_sur_le_marche?: boolean;
  }
) {
  const res = (await API.post({
    path: `/carcasse-modification-request/${id}/approve`,
    body: examinateurFields ?? {},
  })) as CarcasseModificationRequestResponse;
  if (!res.ok || !res.data) {
    return { ok: false as const, error: res.error || 'Erreur inconnue' };
  }
  // After approval, the underlying carcasse changed (numero_bracelet or examinateur fields).
  // Refetch the FEI to refresh local store cleanly.
  useZustandStore.getState().upsertCarcasseModificationRequest(res.data.request);
  return { ok: true as const, data: res.data };
}

export async function rejectModificationRequest(id: string, rejection_reason?: string) {
  const res = (await API.post({
    path: `/carcasse-modification-request/${id}/reject`,
    body: { rejection_reason: rejection_reason ?? null },
  })) as CarcasseModificationRequestResponse;
  if (!res.ok || !res.data) {
    return { ok: false as const, error: res.error || 'Erreur inconnue' };
  }
  useZustandStore.getState().upsertCarcasseModificationRequest(res.data.request);
  return { ok: true as const, data: res.data };
}

export async function fetchModificationRequestsForExaminateur() {
  const res = (await API.get({
    path: '/carcasse-modification-request/for-examinateur',
  })) as CarcasseModificationRequestsForExaminateurResponse;
  if (!res.ok || !res.data) {
    return { ok: false as const, error: res.error || 'Erreur inconnue' };
  }
  // Update local store for each one
  const upsert = useZustandStore.getState().upsertCarcasseModificationRequest;
  for (const r of res.data.requests) {
    upsert(r);
  }
  return { ok: true as const, data: res.data };
}

export { CarcasseModificationRequestStatus, CarcasseModificationRequestType };
