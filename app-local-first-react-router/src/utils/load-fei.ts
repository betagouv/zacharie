import dayjs from 'dayjs';
import type { FeiResponse } from '@api/src/types/responses';
import type { EntityWithUserRelation } from '@api/src/types/entity';
import useZustandStore from '@app/zustand/store';
import {
  getFeiAndCarcasseAndIntermediaireIds,
  getFeiAndIntermediaireIds,
} from '@app/utils/get-carcasse-intermediaire-id';
import type {
  FeiAndCarcasseAndIntermediaireIds,
  FeiAndIntermediaireIds,
  FeiIntermediaire,
} from '@app/types/fei-intermediaire';

export async function loadFei(fei_numero: string) {
  const isOnline = useZustandStore.getState().isOnline;
  if (!isOnline) {
    console.log('not loading fei because not online');
    return;
  }
  const feiData = await fetch(`${import.meta.env.VITE_API_URL}/fei/${fei_numero}`, {
    method: 'GET',
    credentials: 'include',
  })
    .then((res) => res.json())
    .then((res) => res as FeiResponse);
  if (!feiData.ok) {
    return null;
  }
  setFeiInStore(feiData!);
  return feiData.data.fei!;
}

export async function setFeiInStore(feiResponse: FeiResponse) {
  const fei = feiResponse.data.fei!;
  console.log(fei);
  // if (!fei?.numero) {
  //   useZustandStore.setState((state) => {
  //     delete state.feis[fei_numero];
  //     return state;
  //   });
  //   return;
  // }
  const localFei = useZustandStore.getState().feis[fei.numero];
  if (!localFei) {
    useZustandStore.setState((state) => ({
      feis: {
        ...state.feis,
        [fei.numero]: fei,
      },
    }));
  } else {
    const newestFei = dayjs(localFei.updated_at).diff(fei.updated_at) > 0 ? localFei : fei;
    const oldestFei = dayjs(localFei.updated_at).diff(fei.updated_at) > 0 ? fei : localFei;

    useZustandStore.setState((state) => ({
      feis: {
        ...state.feis,
        [fei.numero]: {
          ...oldestFei,
          ...newestFei,
          is_synced: true,
        },
      },
    }));
  }

  const examinateurInitial = fei.FeiExaminateurInitialUser;
  if (examinateurInitial) {
    useZustandStore.setState((state) => ({
      users: {
        ...state.users,
        [examinateurInitial.id]: examinateurInitial,
      },
    }));
  }

  const premierDetenteur = fei.FeiPremierDetenteurUser;
  if (premierDetenteur) {
    useZustandStore.setState((state) => ({
      users: {
        ...state.users,
        [premierDetenteur.id]: premierDetenteur,
      },
    }));
  }

  if (fei.premier_detenteur_entity_id) {
    if (!useZustandStore.getState().entities[fei.premier_detenteur_entity_id]) {
      const premierDetenteurEntity = fei.FeiPremierDetenteurEntity!;
      useZustandStore.setState((state) => ({
        entities: {
          ...state.entities,
          [fei.premier_detenteur_entity_id!]: {
            ...premierDetenteurEntity,
            relation: 'NONE',
          } satisfies EntityWithUserRelation,
        },
      }));
    }
  }

  if (fei.premier_detenteur_depot_entity_id) {
    if (!useZustandStore.getState().entities[fei.premier_detenteur_depot_entity_id]) {
      const depotEntity = fei.FeiDepotEntity!;
      useZustandStore.setState((state) => ({
        entities: {
          ...state.entities,
          [fei.premier_detenteur_depot_entity_id!]: {
            ...depotEntity,
            relation: 'NONE',
          } satisfies EntityWithUserRelation,
        },
      }));
    }
  }

  const currentOwnerUser = fei.FeiCurrentUser;
  if (currentOwnerUser) {
    useZustandStore.setState((state) => ({
      users: {
        ...state.users,
        [currentOwnerUser.id]: currentOwnerUser,
      },
    }));
  }

  if (fei.fei_current_owner_entity_id) {
    if (!useZustandStore.getState().entities[fei.fei_current_owner_entity_id]) {
      const currentOwnerEntity = fei.FeiCurrentEntity!;
      useZustandStore.setState((state) => ({
        entities: {
          ...state.entities,
          [fei.fei_current_owner_entity_id!]: {
            ...currentOwnerEntity,
            relation: 'NONE',
          } satisfies EntityWithUserRelation,
        },
      }));
    }
  }

  const nextOwnerUser = fei.FeiNextUser;
  if (nextOwnerUser) {
    useZustandStore.setState((state) => ({
      users: {
        ...state.users,
        [nextOwnerUser.id]: nextOwnerUser,
      },
    }));
  }

  if (fei.fei_next_owner_entity_id) {
    if (!useZustandStore.getState().entities[fei.fei_next_owner_entity_id]) {
      const nextOwnerEntity = fei.FeiNextEntity!;
      useZustandStore.setState((state) => ({
        entities: {
          ...state.entities,
          [fei.fei_next_owner_entity_id!]: {
            ...nextOwnerEntity,
            relation: 'NONE',
          } satisfies EntityWithUserRelation,
        },
      }));
    }
  }

  const sviUser = fei.FeiSviUser;
  if (sviUser) {
    useZustandStore.setState((state) => ({
      users: {
        ...state.users,
        [sviUser.id]: sviUser,
      },
    }));
  }

  if (fei.svi_entity_id) {
    if (!useZustandStore.getState().entities[fei.svi_entity_id]) {
      const svi = fei.FeiSviEntity!;
      useZustandStore.setState((state) => ({
        entities: {
          ...state.entities,
          [fei.svi_entity_id!]: {
            ...svi,
            relation: 'NONE',
          } satisfies EntityWithUserRelation,
        },
      }));
    }
  }

  const carcasses = fei.Carcasses;
  useZustandStore.setState((state) => ({
    carcassesIdsByFei: {
      ...state.carcassesIdsByFei,
      [fei.numero]: carcasses.map((c) => c.zacharie_carcasse_id),
    },
  }));
  for (const carcasse of carcasses) {
    const localCarcasse = useZustandStore.getState().carcasses[carcasse.zacharie_carcasse_id];
    if (!localCarcasse) {
      useZustandStore.setState((state) => ({
        carcasses: {
          ...state.carcasses,
          [carcasse.zacharie_carcasse_id]: carcasse,
        },
      }));
    } else {
      const newestCarcasse =
        dayjs(localCarcasse.updated_at).diff(carcasse.updated_at) > 0 ? localCarcasse : carcasse;
      const oldestCarcasse =
        dayjs(localCarcasse.updated_at).diff(carcasse.updated_at) > 0 ? carcasse : localCarcasse;

      useZustandStore.setState((state) => ({
        carcasses: {
          ...state.carcasses,
          [carcasse.zacharie_carcasse_id]: {
            ...oldestCarcasse,
            ...newestCarcasse,
            is_synced: true,
          },
        },
      }));
    }
  }

  const carcassesIntermediaires = fei.CarcasseIntermediaire; // already sorted by prise_en_charge_at desc then created_at desc

  const users = useZustandStore.getState().users;
  const entities = useZustandStore.getState().entities;

  const intermediairesByFei: Record<FeiIntermediaire['id'], FeiIntermediaire> = {};

  for (const carcasseIntermediaire of carcassesIntermediaires || []) {
    const carcassesIntermediairesIdsByCarcasse =
      useZustandStore.getState().carcassesIntermediairesIdsByCarcasse;
    const carcassesIntermediaireIdsByIntermediaire =
      useZustandStore.getState().carcassesIntermediaireIdsByIntermediaire;

    if (!users[carcasseIntermediaire.intermediaire_user_id]) {
      const intermediaireUser = carcasseIntermediaire.CarcasseIntermediaireUser;
      useZustandStore.setState((state) => ({
        users: {
          ...state.users,
          [intermediaireUser.id]: intermediaireUser,
        },
      }));
    }

    if (!entities[carcasseIntermediaire.intermediaire_entity_id]) {
      const intermediaireEntity = carcasseIntermediaire.CarcasseIntermediaireEntity;
      useZustandStore.setState((state) => ({
        entities: {
          ...state.entities,
          [carcasseIntermediaire.intermediaire_entity_id!]: {
            ...intermediaireEntity,
            relation: 'NONE',
          } satisfies EntityWithUserRelation,
        },
      }));
    }

    if (!intermediairesByFei[carcasseIntermediaire.intermediaire_id]) {
      const intermediaire = {
        id: carcasseIntermediaire.intermediaire_id,
        fei_numero: fei.numero,
        intermediaire_user_id: carcasseIntermediaire.intermediaire_user_id,
        intermediaire_role: carcasseIntermediaire.intermediaire_role,
        intermediaire_entity_id: carcasseIntermediaire.intermediaire_entity_id,
        created_at: carcasseIntermediaire.created_at,
        prise_en_charge_at: carcasseIntermediaire.prise_en_charge_at,
        intermediaire_depot_type: carcasseIntermediaire.intermediaire_depot_type,
        intermediaire_depot_entity_id: carcasseIntermediaire.intermediaire_depot_entity_id,
        intermediaire_prochain_detenteur_type_cache:
          carcasseIntermediaire.intermediaire_prochain_detenteur_type_cache,
        intermediaire_prochain_detenteur_id_cache:
          carcasseIntermediaire.intermediaire_prochain_detenteur_id_cache,
      };
      intermediairesByFei[carcasseIntermediaire.intermediaire_id] = intermediaire;
    }

    const carcasseId = carcasseIntermediaire.zacharie_carcasse_id;
    const feiAndIntermediaireId = getFeiAndIntermediaireIds(carcasseIntermediaire) as FeiAndIntermediaireIds;
    const feiAndCarcasseAndIntermediaireId = getFeiAndCarcasseAndIntermediaireIds(
      carcasseIntermediaire,
    ) as FeiAndCarcasseAndIntermediaireIds;

    const existingIdsByCarcasse =
      carcassesIntermediairesIdsByCarcasse[carcasseId] || ([] as Array<FeiAndCarcasseAndIntermediaireIds>);
    const idsByCarcasse = new Set(existingIdsByCarcasse);
    const existingIdsByFeiAndIntermediaire =
      carcassesIntermediaireIdsByIntermediaire[feiAndIntermediaireId] ||
      ([] as Array<FeiAndCarcasseAndIntermediaireIds>);
    const idsByFeiAndIntermediaire = new Set(existingIdsByFeiAndIntermediaire);

    idsByCarcasse.add(feiAndCarcasseAndIntermediaireId);
    idsByFeiAndIntermediaire.add(feiAndCarcasseAndIntermediaireId);

    const localCarcasseIntermediaire =
      useZustandStore.getState().carcassesIntermediaireById[feiAndCarcasseAndIntermediaireId];

    if (!localCarcasseIntermediaire) {
      useZustandStore.setState((state) => ({
        carcassesIntermediaireById: {
          ...state.carcassesIntermediaireById,
          [feiAndCarcasseAndIntermediaireId]: carcasseIntermediaire,
        },
        carcassesIntermediaireIdsByIntermediaire: {
          ...state.carcassesIntermediaireIdsByIntermediaire,
          [feiAndIntermediaireId]: [...idsByFeiAndIntermediaire],
        },
        carcassesIntermediairesIdsByCarcasse: {
          ...state.carcassesIntermediairesIdsByCarcasse,
          [carcasseId]: [...idsByCarcasse],
        },
      }));
    } else {
      const newestCarcasseIntermediaire =
        dayjs(localCarcasseIntermediaire.updated_at).diff(carcasseIntermediaire.updated_at) > 0
          ? localCarcasseIntermediaire
          : carcasseIntermediaire;
      const oldestCarcasseIntermediaire =
        dayjs(localCarcasseIntermediaire.updated_at).diff(carcasseIntermediaire.updated_at) > 0
          ? carcasseIntermediaire
          : localCarcasseIntermediaire;
      useZustandStore.setState((state) => ({
        carcassesIntermediaireById: {
          ...state.carcassesIntermediaireById,
          [feiAndCarcasseAndIntermediaireId]: {
            ...oldestCarcasseIntermediaire,
            ...newestCarcasseIntermediaire,
            is_synced: true,
          },
        },
        carcassesIntermediaireIdsByIntermediaire: {
          ...state.carcassesIntermediaireIdsByIntermediaire,
          [feiAndIntermediaireId]: [...idsByFeiAndIntermediaire],
        },
        carcassesIntermediairesIdsByCarcasse: {
          ...state.carcassesIntermediairesIdsByCarcasse,
          [carcasseId]: [...idsByCarcasse],
        },
      }));
    }
  }
  useZustandStore.setState((state) => ({
    intermediairesByFei: {
      ...state.intermediairesByFei,
      [fei.numero]: Object.values(intermediairesByFei).sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
    },
  }));
}
