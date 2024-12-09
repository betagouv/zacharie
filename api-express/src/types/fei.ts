import { Prisma } from '@prisma/client';

export const feiDoneSelect = {
  numero: true,
  created_at: true,
  updated_at: true,
  fei_current_owner_role: true,
  fei_next_owner_role: true,
  commune_mise_a_mort: true,
  svi_assigned_at: true,
  svi_signed_at: true,
  examinateur_initial_date_approbation_mise_sur_le_marche: true,
  premier_detenteur_name_cache: true,
  resume_nombre_de_carcasses: true,
  is_synced: true,
} as const;

export type FeiDone = Prisma.FeiGetPayload<{
  select: typeof feiDoneSelect;
}>;

export type FeiWithIntermediaires = Prisma.FeiGetPayload<{
  include: {
    FeiIntermediaires: {
      include: {
        FeiIntermediairesCarcasses: true;
      };
    };
  };
}>;

export const feiPopulatedInclude = {
  Carcasses: {
    include: {
      CarcasseIntermediaire: true,
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
  FeiSviUser: true,
  FeiSviEntity: true,
  FeiIntermediaires: {
    include: {
      FeiIntermediaireUser: true,
      FeiIntermediaireEntity: true,
      FeiIntermediairesCarcasses: true,
      CarcasseIntermediaire: true,
    },
    orderBy: {
      created_at: Prisma.SortOrder.desc,
    },
  },
};

export type FeiPopulated = Prisma.FeiGetPayload<{
  include: typeof feiPopulatedInclude;
}>;
