import prisma from '~/prisma';
import { Prisma } from '@prisma/client';
import type { CarcasseIntermediaire, User } from '@prisma/client';
import { getUserCarcasseEntityIds } from '~/utils/user-entities';

type SyncCarcasseIntermediaireOpts = {
  // En sync de masse, les entités de l'utilisateur sont les mêmes pour tout le lot : le contrôleur
  // les résout une fois et les passe ici plutôt que de requêter à chaque carcasse.
  userEntityIds?: Array<string>;
};

export async function syncCarcasseIntermediaire(
  fei_numero: string,
  intermediaire_id: string,
  zacharie_carcasse_id: string,
  body: Prisma.CarcasseIntermediaireUncheckedCreateInput,
  user: User,
  opts: SyncCarcasseIntermediaireOpts = {}
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

  // L'identité de l'intermédiaire est décidée par le serveur : l'utilisateur courant agit toujours
  // en son nom propre, pour une entité dont il est membre. Le rôle, lui, vient du client : un ETG
  // enregistre l'étape de transport d'un collecteur, donc un rôle différent du sien est légitime.
  const userEntityIds = opts.userEntityIds ?? (await getUserCarcasseEntityIds(user.id));
  if (!body.intermediaire_entity_id || !userEntityIds.includes(body.intermediaire_entity_id)) {
    throw new Error('Vous ne pouvez pas agir au nom de cette entité');
  }

  const identity = {
    intermediaire_entity_id: body.intermediaire_entity_id,
    intermediaire_role: body.intermediaire_role,
    intermediaire_user_id: user.id,
  };

  const data: Prisma.CarcasseIntermediaireUncheckedCreateInput = {
    fei_numero: fei_numero,
    numero_bracelet: existingCarcasse.numero_bracelet,
    zacharie_carcasse_id: existingCarcasse.zacharie_carcasse_id,
    intermediaire_id,
    ...identity,
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

  // L'identité n'est posée qu'à la création : une prise en charge déjà enregistrée ne doit jamais
  // voir son entité ou son utilisateur réécrits par un autre appelant.
  const { intermediaire_entity_id, intermediaire_role, intermediaire_user_id, ...update } = data;

  const carcasseIntermediaire = await prisma.carcasseIntermediaire.upsert({
    where: {
      fei_numero_zacharie_carcasse_id_intermediaire_id: {
        fei_numero: fei_numero,
        zacharie_carcasse_id: existingCarcasse.zacharie_carcasse_id,
        intermediaire_id: intermediaire_id,
      },
    },
    create: data,
    update,
  });

  return carcasseIntermediaire;
}
