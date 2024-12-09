import dayjs from 'dayjs';
import type { FeiResponse } from '@api/src/types/responses';
import type { EntityWithUserRelation } from '@api/src/types/entity';
import useZustandStore from '@app/zustand/store';

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
          },
        },
      }));
    }
  }

  const intermediaires = fei.FeiIntermediaires.sort(
    (a, b) => dayjs(b.created_at).valueOf() - dayjs(a.created_at).valueOf(),
  ); // newest first

  for (const intermediaire of intermediaires || []) {
    const intermediaireId = intermediaire.id; // {user_id}_{fei_numero}_{HHMMSS}
    const localIntermediaire = useZustandStore.getState().feisIntermediaires[intermediaireId];
    useZustandStore.setState((state) => ({
      ...state,
      feisIntermediairesIdsByFei: {
        ...state.feisIntermediairesIdsByFei,
        [fei.numero]: [
          ...new Set([...(state.feisIntermediairesIdsByFei[fei.numero] || []), intermediaireId]),
        ], // newest first
      },
    }));
    if (!localIntermediaire) {
      useZustandStore.setState((state) => ({
        ...state,
        feisIntermediaires: {
          ...state.feisIntermediaires,
          [intermediaireId]: intermediaire,
        },
      }));
    } else {
      const newestIntermediaire =
        dayjs(localIntermediaire.updated_at).diff(intermediaire.updated_at) > 0
          ? localIntermediaire
          : intermediaire;
      const oldestIntermediaire =
        dayjs(localIntermediaire.updated_at).diff(intermediaire.updated_at) > 0
          ? intermediaire
          : localIntermediaire;

      useZustandStore.setState((state) => ({
        ...state,
        feisIntermediaires: {
          ...state.feisIntermediaires,
          [intermediaireId]: {
            ...oldestIntermediaire,
            ...newestIntermediaire,
          },
        },
      }));
    }

    const intermediaireUser = intermediaire.FeiIntermediaireUser;
    if (intermediaireUser) {
      useZustandStore.setState((state) => ({
        users: {
          ...state.users,
          [intermediaireUser.id]: intermediaireUser,
        },
      }));
    }

    const intermediaireEntity = intermediaire.FeiIntermediaireEntity;
    if (intermediaire.fei_intermediaire_entity_id) {
      if (!useZustandStore.getState().entities[intermediaire.fei_intermediaire_entity_id]) {
        useZustandStore.setState((state) => ({
          entities: {
            ...state.entities,
            [intermediaire.fei_intermediaire_entity_id!]: {
              ...intermediaireEntity,
              relation: 'NONE',
            } satisfies EntityWithUserRelation,
          },
        }));
      }
    }

    const intermediaireCarcasses = intermediaire.CarcasseIntermediaire || []; // it's an array
    useZustandStore.setState((state) => ({
      carcassesIntermediairesByIntermediaire: {
        ...state.carcassesIntermediairesByIntermediaire,
        [intermediaireId]: intermediaireCarcasses.map((c) => c.fei_numero__bracelet__intermediaire_id),
      },
    }));
    for (const carcasseIntermediaire of intermediaireCarcasses) {
      const localCarcasseIntermediaire =
        useZustandStore.getState().carcassesIntermediaires[
          carcasseIntermediaire.fei_numero__bracelet__intermediaire_id
        ];
      if (!localCarcasseIntermediaire) {
        useZustandStore.setState((state) => ({
          carcassesIntermediaires: {
            ...state.carcassesIntermediaires,
            [carcasseIntermediaire.fei_numero__bracelet__intermediaire_id]: carcasseIntermediaire,
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
          carcassesIntermediaires: {
            ...state.carcassesIntermediaires,
            [carcasseIntermediaire.fei_numero__bracelet__intermediaire_id]: {
              ...oldestCarcasseIntermediaire,
              ...newestCarcasseIntermediaire,
            },
          },
        }));
      }
    }
  }
}
