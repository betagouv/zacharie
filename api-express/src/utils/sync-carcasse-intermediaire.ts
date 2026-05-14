import express from 'express';
import prisma from '~/prisma';
import { DepotType, FeiOwnerRole, Prisma } from '@prisma/client';
import type { CarcasseIntermediaire } from '@prisma/client';
import z from 'zod';

export const carcasseIntermediaireBodyZodSchema = z.object({
  fei_numero: z.string(),
  intermediaire_id: z.string(),
  zacharie_carcasse_id: z.string(),
  commentaire: z.string().optional().nullable(),
  intermediaire_poids: z.number().optional().nullable(),
  prise_en_charge: z.boolean().optional().nullable(),
  ecarte_pour_inspection: z.boolean().optional().nullable(),
  check_manuel: z.boolean().optional().nullable(),
  manquante: z.boolean().optional().nullable(),
  refus: z.string().optional().nullable(),
  decision_at: z.string().optional().nullable(),
  prise_en_charge_at: z.string().optional().nullable(),
  intermediaire_prochain_detenteur_id_cache: z.string().optional().nullable(),
  intermediaire_prochain_detenteur_role_cache: z
    .enum(Object.values(FeiOwnerRole) as [FeiOwnerRole, ...FeiOwnerRole[]])
    .optional()
    .nullable(),
  intermediaire_depot_type: z
    .enum(Object.values(DepotType) as [DepotType, ...DepotType[]])
    .optional()
    .nullable(),
  intermediaire_depot_entity_id: z.string().optional().nullable(),
  intermediaire_entity_id: z.string().optional().nullable(),
  intermediaire_role: z
    .enum(Object.values(FeiOwnerRole) as [FeiOwnerRole, ...FeiOwnerRole[]])
    .optional()
    .nullable(),
  intermediaire_user_id: z.string().optional().nullable(),
  nombre_d_animaux_acceptes: z.number().optional().nullable(),
  deleted_at: z.string().optional().nullable(),
  is_synced: z.boolean().optional().nullable(),
  created_at: z.string().optional().nullable(),
  updated_at: z.string().optional().nullable(),
});

export async function saveCarcasseIntermediaire(
  fei_numero: string,
  intermediaire_id: string,
  zacharie_carcasse_id: string,
  body: Prisma.CarcasseIntermediaireUncheckedCreateInput
): Promise<CarcasseIntermediaire> {
  if (!fei_numero) {
    throw new Error('Le numéro de fiche est obligatoire');
  }
  const existingFei = await prisma.fei.findUnique({
    where: { numero: fei_numero },
  });
  if (!existingFei) {
    throw new Error('Fiche non trouvée');
  }
  if (!zacharie_carcasse_id) {
    throw new Error('Le numéro de la carcasse est obligatoire');
  }
  const existingCarcasse = await prisma.carcasse.findFirst({
    where: {
      zacharie_carcasse_id,
      fei_numero,
    },
  });
  if (!existingCarcasse) {
    throw new Error('Carcasse not found');
  }
  if (!intermediaire_id) {
    throw new Error("L'identifiant du destinataire est obligatoire");
  }

  const data: Prisma.CarcasseIntermediaireUncheckedCreateInput = {
    fei_numero: fei_numero,
    numero_bracelet: existingCarcasse.numero_bracelet,
    zacharie_carcasse_id: existingCarcasse.zacharie_carcasse_id,
    intermediaire_id,
    intermediaire_entity_id: body.intermediaire_entity_id,
    intermediaire_role: body.intermediaire_role,
    intermediaire_user_id: body.intermediaire_user_id,
    is_synced: true,
  };

  if (body.hasOwnProperty(Prisma.CarcasseIntermediaireScalarFieldEnum.commentaire)) {
    data.commentaire = body[Prisma.CarcasseIntermediaireScalarFieldEnum.commentaire];
  }
  if (body.hasOwnProperty(Prisma.CarcasseIntermediaireScalarFieldEnum.intermediaire_poids)) {
    data.intermediaire_poids = body[Prisma.CarcasseIntermediaireScalarFieldEnum.intermediaire_poids];
  }
  if (body.hasOwnProperty(Prisma.CarcasseIntermediaireScalarFieldEnum.prise_en_charge)) {
    data.prise_en_charge = body[Prisma.CarcasseIntermediaireScalarFieldEnum.prise_en_charge];
  }
  if (body.hasOwnProperty(Prisma.CarcasseIntermediaireScalarFieldEnum.ecarte_pour_inspection)) {
    data.ecarte_pour_inspection = body[Prisma.CarcasseIntermediaireScalarFieldEnum.ecarte_pour_inspection];
  }
  if (body.hasOwnProperty(Prisma.CarcasseIntermediaireScalarFieldEnum.check_manuel)) {
    data.check_manuel = body[Prisma.CarcasseIntermediaireScalarFieldEnum.check_manuel];
  }
  if (body.hasOwnProperty(Prisma.CarcasseIntermediaireScalarFieldEnum.manquante)) {
    data.manquante = body[Prisma.CarcasseIntermediaireScalarFieldEnum.manquante];
  }
  if (body.hasOwnProperty(Prisma.CarcasseIntermediaireScalarFieldEnum.refus)) {
    data.refus = body[Prisma.CarcasseIntermediaireScalarFieldEnum.refus];
  }
  if (body.hasOwnProperty(Prisma.CarcasseIntermediaireScalarFieldEnum.decision_at)) {
    data.decision_at = body[Prisma.CarcasseIntermediaireScalarFieldEnum.decision_at];
  }
  if (body.hasOwnProperty(Prisma.CarcasseIntermediaireScalarFieldEnum.prise_en_charge_at)) {
    data.prise_en_charge_at = body[Prisma.CarcasseIntermediaireScalarFieldEnum.prise_en_charge_at];
  }
  if (
    body.hasOwnProperty(Prisma.CarcasseIntermediaireScalarFieldEnum.intermediaire_prochain_detenteur_id_cache)
  ) {
    data.intermediaire_prochain_detenteur_id_cache =
      body[Prisma.CarcasseIntermediaireScalarFieldEnum.intermediaire_prochain_detenteur_id_cache];
  }
  if (
    body.hasOwnProperty(
      Prisma.CarcasseIntermediaireScalarFieldEnum.intermediaire_prochain_detenteur_role_cache
    )
  ) {
    data.intermediaire_prochain_detenteur_role_cache =
      body[Prisma.CarcasseIntermediaireScalarFieldEnum.intermediaire_prochain_detenteur_role_cache];
  }
  if (body.hasOwnProperty(Prisma.CarcasseIntermediaireScalarFieldEnum.intermediaire_depot_type)) {
    data.intermediaire_depot_type =
      body[Prisma.CarcasseIntermediaireScalarFieldEnum.intermediaire_depot_type];
  }
  if (body.hasOwnProperty(Prisma.CarcasseIntermediaireScalarFieldEnum.intermediaire_depot_entity_id)) {
    data.intermediaire_depot_entity_id =
      body[Prisma.CarcasseIntermediaireScalarFieldEnum.intermediaire_depot_entity_id];
  }
  if (body.hasOwnProperty(Prisma.CarcasseIntermediaireScalarFieldEnum.nombre_d_animaux_acceptes)) {
    data.nombre_d_animaux_acceptes =
      body[Prisma.CarcasseIntermediaireScalarFieldEnum.nombre_d_animaux_acceptes] ?? null;
  }

  const carcasseIntermediaire = await prisma.carcasseIntermediaire.upsert({
    where: {
      fei_numero_zacharie_carcasse_id_intermediaire_id: {
        fei_numero: fei_numero,
        zacharie_carcasse_id: existingCarcasse.zacharie_carcasse_id,
        intermediaire_id: intermediaire_id,
      },
    },
    create: data,
    update: data,
  });

  return carcasseIntermediaire;
}
