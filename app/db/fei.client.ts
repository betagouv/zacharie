import { type Fei, type User, type Carcasse, type FeiIntermediaire, UserRoles } from "@prisma/client";
import type { FeiWithRelations } from "./fei.server";
import type { MyRelationsLoaderData } from "~/routes/api.loader.my-relations";

type OfflineFeiWithExaminateurFieldsOmitted = Omit<
  FeiWithRelations,
  | "id"
  | "created_at"
  | "updated_at"
  | "numero"
  | "date_mise_a_mort"
  | "created_by_user_id"
  | "FeiExaminateurInitialUser"
  | "fei_current_owner_user_id"
  | "fei_current_owner_role"
  | "examinateur_initial_user_id"
  | "FeiCreatedByUser"
  | "FeiCurrentUser"
>;

function offlineNullFeiToBeCompletedByExaminateurFields(): OfflineFeiWithExaminateurFieldsOmitted {
  return {
    commune_mise_a_mort: null,
    fei_current_owner_entity_id: null,
    fei_current_owner_wants_to_transfer: null,
    fei_next_owner_user_id: null,
    fei_next_owner_entity_id: null,
    fei_next_owner_role: null,
    fei_prev_owner_user_id: null,
    fei_prev_owner_entity_id: null,
    fei_prev_owner_role: null,
    examinateur_initial_approbation_mise_sur_le_marche: null,
    examinateur_initial_date_approbation_mise_sur_le_marche: null,
    premier_detenteur_user_id: null,
    premier_detenteur_date_depot_quelque_part: null,
    premier_detenteur_depot_entity_id: null,
    premier_detenteur_depot_sauvage: null,
    svi_entity_id: null,
    svi_user_id: null,
    svi_carcasses_saisies: null,
    svi_aucune_carcasse_saisie: null,
    svi_commentaire: null,
    svi_signed_at: null,
    deleted_at: null,
    FeiCurrentEntity: null,
    FeiNextEntity: null,
    Carcasses: [],
    FeiPremierDetenteurUser: null,
    FeiDepotEntity: null,
    FeiSviEntity: null,
    FeiSviUser: null,
    FeiIntermediaires: [],
  } as const;
}

export type FeiAction =
  | "fei_action_nouvelle"
  | "fei_action_confirm_current_owner"
  | "fei_action_reject_current_owner"
  | "fei_action_examinateur_initial"
  | "fei_action_premier_detenteur"
  | "fei_action_premier_detenteur_depot"
  | "fei_action_next_role";

export function formatFeiOfflineQueue(
  existingFeiPopulated: FeiWithRelations,
  nextFeiData: Fei,
  me: User,
  relations: MyRelationsLoaderData["data"],
  step: FeiAction,
): FeiWithRelations {
  if (!existingFeiPopulated) {
    return formatFeiOfflineQueueNouvelleFei(nextFeiData, me);
  }
  switch (step) {
    case "fei_action_nouvelle":
      console.log("BIMBADADABOOM");
      return formatFeiOfflineQueueNouvelleFei(nextFeiData, me);
    case "fei_action_confirm_current_owner":
      return formatFeiOfflineQueueConfirmCurrentOwner(existingFeiPopulated, nextFeiData, me, relations);
    case "fei_action_premier_detenteur_depot":
      return formatFeiOfflineQueuePremierDetenteurDepot(existingFeiPopulated, nextFeiData, relations);
    case "fei_action_next_role":
      return formatFeiOfflineQueueNextEntity(existingFeiPopulated, nextFeiData, relations);
    case "fei_action_reject_current_owner":
    case "fei_action_examinateur_initial":
    case "fei_action_premier_detenteur":
    default:
      return {
        ...existingFeiPopulated,
        ...nextFeiData,
      };
  }
}

function formatFeiOfflineQueueNouvelleFei(fei: Fei, me: User): FeiWithRelations {
  const baseFei = offlineNullFeiToBeCompletedByExaminateurFields();

  console.log("formatFeiOfflineQueueNouvelleFei", {
    fei,
    me,
    offline: {
      ...baseFei,
      id: Date.now(),
      numero: fei.numero,
      date_mise_a_mort: fei.date_mise_a_mort,
      created_by_user_id: me.id,
      fei_current_owner_user_id: me.id,
      fei_current_owner_role: UserRoles.EXAMINATEUR_INITIAL,
      examinateur_initial_user_id: me.id,
      created_at: fei.created_at,
      updated_at: fei.updated_at,
      FeiExaminateurInitialUser: me,
      FeiCreatedByUser: me,
      FeiCurrentUser: me,
    },
  });

  return {
    ...baseFei,
    id: Date.now(),
    numero: fei.numero,
    date_mise_a_mort: fei.date_mise_a_mort,
    created_by_user_id: me.id,
    fei_current_owner_user_id: me.id,
    fei_current_owner_role: UserRoles.EXAMINATEUR_INITIAL,
    examinateur_initial_user_id: me.id,
    created_at: fei.created_at,
    updated_at: fei.updated_at,
    FeiExaminateurInitialUser: me,
    FeiCreatedByUser: me,
    FeiCurrentUser: me,
  };
}

function formatFeiOfflineQueueConfirmCurrentOwner(
  existingFeiPopulated: FeiWithRelations,
  fei: Fei,
  me: User,
  relations: MyRelationsLoaderData["data"],
): FeiWithRelations {
  return {
    ...existingFeiPopulated,
    ...fei,
    FeiCurrentUser: me,
    FeiCurrentEntity: relations!.entitiesUserIsWorkingFor.find(
      (entity) => entity.id === fei.fei_current_owner_entity_id,
    )!,
    FeiNextEntity: null,
  };
}

function formatFeiOfflineQueuePremierDetenteurDepot(
  existingFeiPopulated: FeiWithRelations,
  fei: Fei,
  relations: MyRelationsLoaderData["data"],
): FeiWithRelations {
  const allEntities = [
    ...relations!.entitiesUserIsWorkingFor,
    ...relations!.collecteursPro,
    ...relations!.ccgs,
    ...relations!.etgs,
    ...relations!.svis,
  ];

  return {
    ...existingFeiPopulated,
    ...fei,
    FeiDepotEntity: allEntities.find((entity) => entity.id === fei.premier_detenteur_depot_entity_id)!,
  };
}

function formatFeiOfflineQueueNextEntity(
  existingFeiPopulated: FeiWithRelations,
  fei: Fei,
  relations: MyRelationsLoaderData["data"],
): FeiWithRelations {
  const allEntities = [
    ...relations!.entitiesUserIsWorkingFor,
    ...relations!.collecteursPro,
    ...relations!.ccgs,
    ...relations!.etgs,
    ...relations!.svis,
  ];

  return {
    ...existingFeiPopulated,
    ...fei,
    FeiNextEntity: allEntities.find((entity) => entity.id === fei.fei_next_owner_entity_id)!,
  };
}

export function formatFeiOfflineQueueCarcasse(
  existingFeiPopulated: FeiWithRelations,
  carcasse: Carcasse,
): FeiWithRelations {
  const existingCarcasse = existingFeiPopulated.Carcasses.find((c) => c.numero_bracelet === carcasse.numero_bracelet);

  return {
    ...existingFeiPopulated,
    Carcasses: [
      ...existingFeiPopulated.Carcasses.filter((c) => c.numero_bracelet !== carcasse.numero_bracelet),
      {
        ...existingCarcasse,
        ...carcasse,
      },
    ].sort((a, b) => a.numero_bracelet.localeCompare(b.numero_bracelet)),
  };
}

export function formatFeiOfflineQueueFeiIntermediaire(
  existingFeiPopulated: FeiWithRelations,
  feiIntermediaire: FeiIntermediaire,
  me: User,
  relations: MyRelationsLoaderData["data"],
): FeiWithRelations {
  const intermediaireEntity = relations!.entitiesUserIsWorkingFor.find(
    (entity) => entity.id === feiIntermediaire.fei_intermediaire_entity_id,
  )!;
  const newIntermediaire: FeiWithRelations["FeiIntermediaires"][0] = {
    id: feiIntermediaire.id,
    fei_numero: feiIntermediaire.fei_numero,
    created_at: feiIntermediaire.created_at,
    deleted_at: feiIntermediaire.deleted_at,
    commentaire: feiIntermediaire.commentaire,
    received_at: feiIntermediaire.received_at,
    handover_at: feiIntermediaire.handover_at,
    check_finished_at: feiIntermediaire.check_finished_at,
    updated_at: feiIntermediaire.updated_at,
    fei_intermediaire_role: feiIntermediaire.fei_intermediaire_role,
    fei_intermediaire_user_id: feiIntermediaire.fei_intermediaire_user_id,
    fei_intermediaire_entity_id: feiIntermediaire.fei_intermediaire_entity_id,
    CarcasseIntermediaire: [],
    FeiIntermediaireEntity: {
      raison_sociale: intermediaireEntity.raison_sociale,
      siret: intermediaireEntity.siret,
      type: intermediaireEntity.type,
      numero_ddecpp: intermediaireEntity.numero_ddecpp,
      address_ligne_1: intermediaireEntity.address_ligne_1,
      address_ligne_2: intermediaireEntity.address_ligne_2,
      code_postal: intermediaireEntity.code_postal,
      ville: intermediaireEntity.ville,
    },
    FeiIntermediaireUser: {
      nom_de_famille: me.nom_de_famille,
      prenom: me.prenom,
      email: me.email,
      telephone: me.telephone,
    },
  };
  return {
    ...existingFeiPopulated,
    FeiIntermediaires: [...existingFeiPopulated.FeiIntermediaires, newIntermediaire],
  };
}
