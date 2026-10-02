import type { State } from '@app/zustand/store';

type SyncableState = Pick<
  State,
  'feis' | 'carcasses' | 'carcassesIntermediaireById' | 'modifRequestsByCarcasseId' | 'logs'
>;

// Vrai si au moins un item local attend encore d'être écrit côté serveur.
export function hasUnsyncedData(state: SyncableState): boolean {
  return (
    Object.values(state.feis).some((f) => !f.is_synced) ||
    Object.values(state.carcasses).some((c) => !c.is_synced) ||
    Object.values(state.carcassesIntermediaireById).some((ci) => !ci.is_synced) ||
    Object.values(state.modifRequestsByCarcasseId).some((requests) => requests.some((r) => !r.is_synced)) ||
    state.logs.some((l) => !l.is_synced)
  );
}
