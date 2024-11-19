import type { Prisma } from '@prisma/client';

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
} as const;

export type FeiDone = Prisma.FeiGetPayload<{
  select: typeof feiDoneSelect;
}>;
