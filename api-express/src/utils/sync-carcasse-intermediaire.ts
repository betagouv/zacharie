import prisma from '~/prisma';
import { Prisma } from '@prisma/client';
import type { CarcasseIntermediaire } from '@prisma/client';

export async function syncCarcasseIntermediaire(
  fei_numero: string,
  intermediaire_id: string,
  zacharie_carcasse_id: string,
  body: Prisma.CarcasseIntermediaireUncheckedCreateInput,
  // Client transactionnel optionnel : quand /sync couple la carcasse et son intermédiaire dans
  // une même transaction (prise en charge atomique), un throw ici rollback aussi le changement
  // d'ownership de la carcasse. Voir sync.ts.
  tx: Prisma.TransactionClient = prisma
): Promise<CarcasseIntermediaire> {
  if (!fei_numero) {
    throw new Error('Le numéro de fiche est obligatoire');
  }
  const existingFei = await tx.fei.findUnique({
    where: { numero: fei_numero },
  });
  if (!existingFei) {
    throw new Error('Fiche non trouvée');
  }
  if (!zacharie_carcasse_id) {
    throw new Error('Le numéro de la carcasse est obligatoire');
  }
  const existingCarcasse = await tx.carcasse.findFirst({
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
  // intermediaire_entity_id et intermediaire_user_id sont des FK NON-nullables : un id vide (le
  // front envoie `next_owner_entity_id || ''` quand l'entité manque) violerait la FK et ferait
  // échouer l'upsert silencieusement, laissant la carcasse sans CarcasseIntermediaire (ownership
  // orphelin). On rejette tôt et explicitement pour déclencher le rollback de la transaction.
  if (!body.intermediaire_entity_id) {
    throw new Error("L'établissement du destinataire est obligatoire");
  }
  if (!body.intermediaire_user_id) {
    throw new Error("L'utilisateur du destinataire est obligatoire");
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

  const carcasseIntermediaire = await tx.carcasseIntermediaire.upsert({
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
