// import * as zodSchemas from "prisma/generated/zod";
import dayjs from 'dayjs';
// import { SerializeFrom } from '@remix-run/node';
import { type Carcasse, type CarcasseIntermediaire } from '@prisma/client';
import type { FeiResponse } from '@api/src/types/responses';
import type { EntityWithUserRelation } from '@api/src/types/entity';
// import { type FeiLoaderData } from '@api/routes/api.fei.$fei_numero';
// import { type FeiUserLoaderData } from '@api/routes/api.fei-user.$fei_numero.$user_id';
// import { type FeiEntityLoaderData } from '@api/routes/api.fei-entity.$fei_numero.$entity_id';
// import { type CarcassesLoaderData } from '@api/routes/api.fei-carcasses.$fei_numero';
// import { type FeiIntermediairesLoaderData } from '@api/routes/api.fei-intermediaires.$fei_numero';
// import {
//   type CarcasseIntermediaireLoaderData,
//   type CarcasseIntermediaireActionData,
// } from '@api/routes/api.fei-carcasse-intermediaire.$fei_numero.$intermediaire_id.$numero_bracelet';
// import { mergeCarcasseIntermediaire } from './carcasse-intermediaire.client';
import useZustandStore from '@app/zustand/store';

export async function loadFei(fei_numero: string) {
  const feiData = await fetch(`${import.meta.env.VITE_API_URL}/fei/${fei_numero}`, {
    method: 'GET',
    credentials: 'include',
  })
    .then((res) => res.json())
    .then((res) => res as FeiResponse);

  if (!feiData.ok) {
    return;
  }

  const fei = feiData.data?.fei;
  if (!fei?.numero) {
    useZustandStore.setState((state) => {
      delete state.feis[fei_numero];
      return state;
    });
    return;
  }
  useZustandStore.setState((state) => ({ feis: { ...state.feis, [fei.numero]: fei } }));

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
    carcassesByFei: {
      ...state.carcassesByFei,
      [fei.numero]: carcasses.map((c) => c.zacharie_carcasse_id),
    },
  }));
  for (const carcasse of carcasses) {
    useZustandStore.setState((state) => ({
      carcasses: {
        ...state.carcasses,
        [carcasse.zacharie_carcasse_id]: carcasse,
      },
    }));
  }

  const intermediaires = fei.FeiIntermediaires;

  for (const intermediaire of intermediaires || []) {
    useZustandStore.setState((state) => ({
      feisIntermediaires: {
        ...state.feisIntermediaires,
        [intermediaire.id]: intermediaire,
      },
    }));

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

    const intermediaireCarcasses: Record<Carcasse['zacharie_carcasse_id'], CarcasseIntermediaire> = {};
    for (const carcasse of carcasses || []) {
      if (carcasse.intermediaire_carcasse_refus_intermediaire_id) {
        const refusOrManquanteAt = carcasse.intermediaire_carcasse_signed_at;
        if (refusOrManquanteAt && intermediaire.created_at > refusOrManquanteAt) {
          continue;
        }
      }
      const carcasseIntermediaireId = `${fei_numero}__${carcasse.numero_bracelet}__${intermediaire.id}`; // fei_numero__bracelet__intermediaire_id
      let carcasseIntermediaire = useZustandStore.getState().carcassesIntermediaires[carcasseIntermediaireId];

      if (!carcasseIntermediaire) {
        const newCarcasseIntermediaire: CarcasseIntermediaire = {
          fei_numero__bracelet__intermediaire_id: `${fei_numero}__${carcasse.numero_bracelet}__${intermediaire.id}`,
          fei_numero: fei_numero,
          numero_bracelet: carcasse.numero_bracelet,
          zacharie_carcasse_id: carcasse.zacharie_carcasse_id,
          fei_intermediaire_id: intermediaire.id,
          fei_intermediaire_user_id: intermediaire.fei_intermediaire_user_id,
          fei_intermediaire_entity_id: intermediaire.fei_intermediaire_entity_id,
          created_at: dayjs().toDate(),
          updated_at: dayjs().toDate(),
          prise_en_charge: !carcasse.intermediaire_carcasse_manquante,
          manquante: carcasse.intermediaire_carcasse_manquante,
          refus: null,
          commentaire: null,
          carcasse_check_finished_at: null,
          deleted_at: null,
          is_synced: false,
        };
        useZustandStore.setState((state) => ({
          carcassesIntermediaires: {
            ...state.carcassesIntermediaires,
            [newCarcasseIntermediaire.fei_numero__bracelet__intermediaire_id]: newCarcasseIntermediaire,
          },
        }));
        carcasseIntermediaire = newCarcasseIntermediaire;
      }
      intermediaireCarcasses[carcasse.zacharie_carcasse_id] = carcasseIntermediaire;
    }
  }
}
