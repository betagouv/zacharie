import { Prisma } from '@prisma/client';

export type FeiWithIntermediaires = Prisma.FeiGetPayload<{
  include: {
    CarcasseIntermediaire: true;
  };
}>;

export const feiPopulatedInclude = {
  Carcasses: {
    include: {
      CarcasseIntermediaire: true,
      CarcasseModificationRequests: {
        where: { deleted_at: null as Date | null },
        orderBy: { requested_at: Prisma.SortOrder.desc },
      },
    },
  },
  FeiExaminateurInitialUser: true,
  FeiPremierDetenteurUser: true,
  FeiPremierDetenteurEntity: true,
  FeiDepotEntity: true,
  FeiCurrentUser: true,
  FeiCurrentEntity: true,
  FeiNextUser: true,
  FeiNextEntity: true,
  FeiSoustraiteByEntity: true,
  FeiSoustraiteByUser: true,
  FeiSviUser: true,
  FeiSviEntity: true,
  CarcasseIntermediaire: {
    include: {
      CarcasseIntermediaireEntity: true,
      CarcasseIntermediaireUser: true,
    },
    orderBy: [{ prise_en_charge_at: Prisma.SortOrder.desc }, { created_at: Prisma.SortOrder.desc }],
  },
} satisfies Prisma.FeiInclude;

export type FeiPopulated = Prisma.FeiGetPayload<{
  include: typeof feiPopulatedInclude;
}>;

export const feiForApiSelect: Prisma.FeiSelect = {
  numero: true,
  date_mise_a_mort: true,
  creation_context: true,
  commune_mise_a_mort: true,
  heure_mise_a_mort_premiere_carcasse: true,
  heure_evisceration_derniere_carcasse: true,
  resume_nombre_de_carcasses: true,
  // examinateur_initial_name: true,
  examinateur_initial_user_id: true,
  examinateur_initial_approbation_mise_sur_le_marche: true,
  examinateur_initial_date_approbation_mise_sur_le_marche: true,
  // premier_detenteur_name: true,
  premier_detenteur_user_id: true,
  premier_detenteur_entity_id: true,
  premier_detenteur_depot_type: true,
  // premier_detenteur_depot_name: true,
  premier_detenteur_depot_ccg_at: true,
  premier_detenteur_transport_type: true,
  premier_detenteur_transport_date: true,
  premier_detenteur_prochain_detenteur_role_cache: true,
  // premier_detenteur_prochain_detenteur_name: true,
  intermediaire_closed_by_entity_id: true,
  intermediaire_closed_at: true,
  // intermediaire_closed_by_name: true,
  // latest_intermediaire_name: true,
  svi_entity_id: true,
  svi_user_id: true,
  svi_assigned_at: true,
  // svi_entity_name: true,
  CarcasseIntermediaire: {
    orderBy: {
      created_at: Prisma.SortOrder.desc,
    },
    include: {
      CarcasseIntermediaireEntity: true,
    },
  },
  FeiExaminateurInitialUser: true,
  FeiPremierDetenteurUser: true,
  FeiPremierDetenteurEntity: true,
  FeiDepotEntity: true,
  // FeiCurrentUser: true,
  // FeiCurrentEntity: true,
  // FeiNextUser: true,
  // FeiNextEntity: true,
  // FeiSviUser: true,
  FeiSviEntity: true,
  svi_closed_at: true,
  automatic_closed_at: true,
  created_at: true,
  updated_at: true,
  deleted_at: true,
} as const;

export type FeiGetForApi = Prisma.FeiGetPayload<{
  select: typeof feiForApiSelect;
}>;
