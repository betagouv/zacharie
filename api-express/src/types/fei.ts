import { Prisma } from '@prisma/client';

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
  premier_detenteur_user_id: true,
  premier_detenteur_entity_id: true,
  FeiExaminateurInitialUser: true,
  FeiPremierDetenteurUser: true,
  FeiPremierDetenteurEntity: true,
  created_at: true,
  updated_at: true,
  deleted_at: true,
} as const;

export type FeiGetForApi = Prisma.FeiGetPayload<{
  select: typeof feiForApiSelect;
}>;
