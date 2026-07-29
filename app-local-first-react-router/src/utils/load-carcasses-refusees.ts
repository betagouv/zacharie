import type { CarcassesRefuseesResponse } from '@api/src/types/responses';
import useZustandStore from '@app/zustand/store';
import useUser from '@app/zustand/user';
import API from '@app/services/api';
import { mergeItems } from './merge-fetched-items';
import { getFeiAndCarcasseAndIntermediaireIds } from './get-carcasse-intermediaire-id';

// Charge les carcasses d'une fiche hors du périmètre de synchro delta (refusées/manquantes/
// orphelines) et les merge dans le store. Le pull delta /carcasse ne les renvoie jamais aux
// détenteurs suivants ni au SVI (leur updated_at ne rebouge pas après le refus), alors qu'elles
// font partie du champ de contrôle : on va donc les chercher par fiche, à la demande.
//
// On ne touche PAS lastUpdateFromServer : ce chargement est hors du curseur delta.
export async function loadCarcassesRefusees(feiNumero: string) {
  if (!feiNumero) return;
  if (!useZustandStore.getState().isOnline) return;

  const res = (await API.get({ path: `/carcasse/refusees/${feiNumero}` }).then((r) => r)) as
    | CarcassesRefuseesResponse
    | undefined;
  if (!res?.ok || !res.data) return;
  // Garde contre une déconnexion pendant le fetch : ne pas réécrire un store fraîchement reset.
  if (!useUser.getState().user) return;

  const { carcasses, carcassesIntermediaires, entities } = res.data;
  if (!carcasses.length) return;

  const newCarcasses = mergeItems({
    oldItems: Object.values(useZustandStore.getState().carcasses) || [],
    newItems: carcasses,
    idKey: (c) => c.zacharie_carcasse_id,
  });

  const newCarcassesIntermediaires = mergeItems({
    oldItems: Object.values(useZustandStore.getState().carcassesIntermediaireById) || [],
    newItems: carcassesIntermediaires,
    idKey: getFeiAndCarcasseAndIntermediaireIds,
  });

  // Comme load-carcasses : on ne comble que les trous, pour préserver la relation metadata des
  // entités déjà chargées (via load-my-relations) — les entités de fiche portent la relation NONE.
  const newEntities = { ...useZustandStore.getState().entities };
  for (const entity of entities) {
    if (!entity.deleted_at && !newEntities[entity.id]) {
      newEntities[entity.id] = entity;
    }
  }

  useZustandStore.setState(() => ({
    carcasses: newCarcasses,
    carcassesRegistry: Object.values(newCarcasses),
    carcassesIntermediaireById: newCarcassesIntermediaires,
    entities: newEntities,
  }));
}
