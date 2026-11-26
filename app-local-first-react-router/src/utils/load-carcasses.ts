import type { CarcassesCountResponse, CarcassesGetResponse } from '@api/src/types/responses';
import useZustandStore from '@app/zustand/store';
import { mergeItems } from './merge-fetched-items';
import API from '@app/services/api';
import { getFeiAndCarcasseAndIntermediaireIds } from './get-carcasse-intermediaire-id';
import { UserRoles, type Carcasse, type CarcasseModificationRequest } from '@prisma/client';
import useUser from '@app/zustand/user';
import { capture } from '@app/services/sentry';
import { isLocalTeardownInProgress } from '@app/zustand/idb-sliced-storage';
import { dropMarginOverwrites, getDeltaAfter } from './delta-margin';

let loadCarcassesAbortController: AbortController | null = null;

const ROLES_WITHOUT_CARCASSES: UserRoles[] = [UserRoles.FEDERATION, UserRoles.LABORATOIRE];

const INTEGRITY_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
let lastIntegrityCheck: { userId: string; at: number } | null = null;
let fullReloadRequested = false;

async function checkLocalCarcassesIntegrity(signal: AbortSignal) {
  const user = useUser.getState().user;
  if (!user) return;
  if (
    lastIntegrityCheck?.userId === user.id &&
    Date.now() - lastIntegrityCheck.at < INTEGRITY_CHECK_INTERVAL_MS
  ) {
    return;
  }
  lastIntegrityCheck = { userId: user.id, at: Date.now() };

  const res = (await API.get({ path: '/carcasse/count', signal })) as CarcassesCountResponse;
  if (signal.aborted || !res.ok || !res.data || useUser.getState().user?.id !== user.id) return;

  const state = useZustandStore.getState();
  if (Object.values(state.carcasses).some((c) => !c.deleted_at && !c.is_synced)) return;
  const refuseesHorsPerimetre = new Set(res.data.refuseesHorsPerimetreIds);
  const localCarcasses = Object.values(state.carcasses).filter(
    (c) => !c.deleted_at && !refuseesHorsPerimetre.has(c.zacharie_carcasse_id)
  );

  const serverCount = res.data.count;
  const localCount = localCarcasses.length;
  if (serverCount === localCount) return;

  capture('Écart entre le nombre de carcasses du serveur et du store local', {
    extra: {
      serverCount,
      localCount,
      lastUpdateFromServer: state.lastUpdateFromServer,
      role: user.roles.join(', '),
    },
    tags: {
      integrity_gap: serverCount > localCount ? 'manquantes_localement' : 'en_trop_localement',
    },
  });
  fullReloadRequested = true;
  loadCarcasses();
}

export function abortLoadCarcasses(reason: string = 'aborted') {
  if (loadCarcassesAbortController && !loadCarcassesAbortController.signal.aborted) {
    loadCarcassesAbortController.abort(reason);
  }
  loadCarcassesAbortController = null;
}

export async function loadCarcasses() {
  if (isLocalTeardownInProgress()) {
    console.log('not loading carcasses because local state is being cleared');
    return;
  }
  const isOnline = useZustandStore.getState().isOnline;
  if (!isOnline) {
    console.log('not loading carcasses because not online');
    return;
  }
  const roles = useUser.getState().user?.roles ?? [];
  if (roles.some((role) => ROLES_WITHOUT_CARCASSES.includes(role))) return;

  if (loadCarcassesAbortController && !loadCarcassesAbortController.signal.aborted) {
    loadCarcassesAbortController.abort('new load requested');
  }
  loadCarcassesAbortController = new AbortController();
  const signal = loadCarcassesAbortController.signal;

  try {
    const serverDate = await API.get({ path: 'now', signal }).then((res) => (res.ok ? res.data : null));
    if (signal.aborted) return;

    const lastUpdateFromServer = useZustandStore.getState().lastUpdateFromServer;
    const after = String(getDeltaAfter(lastUpdateFromServer));
    const reloadVersion = fullReloadRequested
      ? '-1'
      : String(useZustandStore.getState().carcassesReloadVersion);
    const carcassesFetched: CarcassesGetResponse['data']['carcasses'] = [];
    const feisFetched: CarcassesGetResponse['data']['feis'] = [];
    const carcassesIntermediairesFetched: CarcassesGetResponse['data']['carcassesIntermediaires'] = [];
    const carcasseModifRequests: CarcassesGetResponse['data']['carcasseModifRequests'] = [];
    const usersFetched: CarcassesGetResponse['data']['users'] = [];
    const entitiesFetched: CarcassesGetResponse['data']['entities'] = [];
    let cursor: { updatedAt: string; id: string } | null = null;
    let hasMore = true;
    let fullReload = false;
    let receivedReloadVersion = 0;
    let pageCount = 0;

    while (hasMore) {
      pageCount++;
      const query: Record<string, string> = { after, withDeleted: 'true', limit: '5000', reloadVersion };
      if (cursor) {
        query.cursorUpdatedAt = cursor.updatedAt;
        query.cursorId = cursor.id;
      }
      const res: CarcassesGetResponse = await API.get({
        path: '/carcasse',
        query,
        signal,
      }).then((r) => r as CarcassesGetResponse);
      if (signal.aborted) return;
      if (!res.ok || !res.data) return null;

      carcassesFetched.push(...(res.data.carcasses || []));
      feisFetched.push(...(res.data.feis || []));
      usersFetched.push(...(res.data.users || []));
      entitiesFetched.push(...(res.data.entities || []));
      carcasseModifRequests.push(...(res.data.carcasseModifRequests || []));
      carcassesIntermediairesFetched.push(...(res.data.carcassesIntermediaires || []));
      if (!cursor) {
        fullReload = res.data.fullReload;
        receivedReloadVersion = res.data.reloadVersion;
        if (fullReload) fullReloadRequested = false;
      }
      const lastCarcasse: Carcasse | undefined = res.data.carcasses?.at(-1);
      hasMore = res.data.hasMore && !!lastCarcasse;
      if (lastCarcasse) {
        cursor = {
          updatedAt: String(new Date(lastCarcasse.updated_at).getTime()),
          id: lastCarcasse.zacharie_carcasse_id,
        };
      }
    }

    if (signal.aborted || !useUser.getState().user) return;

    if (carcassesFetched.length === 0 && feisFetched.length === 0 && !fullReload) {
      console.log('no carcasses nor feis fetched');
      useZustandStore.setState(() => ({
        lastUpdateFromServer: serverDate,
        carcassesReloadVersion: receivedReloadVersion,
      }));
      checkLocalCarcassesIntegrity(signal);
      return;
    }

    const keepLocal = <T extends { is_synced: boolean }>(items: Array<T>) =>
      fullReload ? items.filter((item) => !item.is_synced) : items;

    const guardMargin = <T extends { updated_at: Date | string; is_synced: boolean }>(
      fetched: Array<T>,
      local: Record<string, T | undefined>,
      idKey: (item: T) => string
    ) => (fullReload ? fetched : dropMarginOverwrites({ fetched, local, lastUpdateFromServer, idKey }));
    const localState = useZustandStore.getState();
    const localModifRequestsById: Record<string, CarcasseModificationRequest> = {};
    for (const request of Object.values(localState.modifRequestsByCarcasseId).flat()) {
      localModifRequestsById[request.id] = request;
    }

    const newCarcasses = mergeItems({
      oldItems: keepLocal(Object.values(useZustandStore.getState().carcasses)),
      newItems: guardMargin(carcassesFetched, localState.carcasses, (c) => c.zacharie_carcasse_id),
      idKey: (c) => c.zacharie_carcasse_id,
    });

    const newFeis = mergeItems({
      oldItems: keepLocal(Object.values(useZustandStore.getState().feis)),
      newItems: feisFetched,
      idKey: (c) => c.numero,
    });

    const newCarcassesIntermediaires = mergeItems({
      oldItems: keepLocal(Object.values(useZustandStore.getState().carcassesIntermediaireById)),
      newItems: guardMargin(
        carcassesIntermediairesFetched,
        localState.carcassesIntermediaireById,
        getFeiAndCarcasseAndIntermediaireIds
      ),
      idKey: getFeiAndCarcasseAndIntermediaireIds,
    });

    const newUsers = mergeItems({
      oldItems: Object.values(useZustandStore.getState().users) || [],
      newItems: usersFetched,
      idKey: (c) => c.id,
    });

    const newEntities = { ...useZustandStore.getState().entities };
    for (const entity of entitiesFetched) {
      if (!entity.deleted_at && !newEntities[entity.id]) {
        newEntities[entity.id] = entity;
      }
    }

    const mergedModifRequestsById = mergeItems({
      oldItems: keepLocal(Object.values(useZustandStore.getState().modifRequestsByCarcasseId).flat()),
      newItems: guardMargin(carcasseModifRequests, localModifRequestsById, (r) => r.id),
      idKey: (r) => r.id,
    });
    const nextModifRequestsByCarcasseId: Record<string, Array<CarcasseModificationRequest>> = {};
    for (const request of Object.values(mergedModifRequestsById) as Array<CarcasseModificationRequest>) {
      (nextModifRequestsByCarcasseId[request.zacharie_carcasse_id] ??= []).push(request);
    }
    for (const [carcasseId, requests] of Object.entries(nextModifRequestsByCarcasseId)) {
      const previousRequests = localState.modifRequestsByCarcasseId[carcasseId];
      if (
        previousRequests?.length === requests.length &&
        requests.every((request) => previousRequests.includes(request))
      ) {
        nextModifRequestsByCarcasseId[carcasseId] = previousRequests;
      }
    }

    if (signal.aborted || !useUser.getState().user) return;

    const feiNumerosBackInScope = new Set(carcassesFetched.map((c) => c.fei_numero));

    useZustandStore.setState((state) => ({
      carcasses: newCarcasses,
      feiIdsRenvoiToHide: state.feiIdsRenvoiToHide.filter(
        (fei_numero) => !feiNumerosBackInScope.has(fei_numero)
      ),
      feis: newFeis,
      carcassesIntermediaireById: newCarcassesIntermediaires,
      modifRequestsByCarcasseId: nextModifRequestsByCarcasseId,
      users: newUsers,
      entities: newEntities,
      lastUpdateFromServer: serverDate,
      carcassesReloadVersion: receivedReloadVersion,
    }));
    if (fullReload && pageCount > 1) {
      loadCarcasses();
      return;
    }
    checkLocalCarcassesIntegrity(signal);
  } finally {
    if (loadCarcassesAbortController?.signal === signal) {
      loadCarcassesAbortController = null;
    }
  }
}
