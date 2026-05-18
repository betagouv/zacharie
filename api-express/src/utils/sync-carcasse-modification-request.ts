import prisma from '~/prisma';
import {
  CarcasseModificationRequestStatus,
  CarcasseModificationRequestType,
  Prisma,
  type CarcasseModificationRequest,
  type User,
} from '@prisma/client';
import sendNotificationToUser from '~/service/notifications';
import { capture } from '~/third-parties/sentry';
import dayjs from 'dayjs';

const FRONTEND_URL = 'https://zacharie.beta.gouv.fr';

export type SyncModifRequestResult = {
  saved: CarcasseModificationRequest;
  isNew: boolean;
  transitionedTo: CarcasseModificationRequestStatus | null; // set when status flipped
};

/**
 * Sync a single CarcasseModificationRequest from the client.
 * Server-side, applies authoritative state transitions:
 *  - on create (status=PENDING)            → notify examinateur
 *  - on approve (PENDING → APPROVED)       → mutate the underlying Carcasse, notify requester
 *  - on reject  (PENDING → REJECTED)       → for NEW soft-delete the Carcasse, notify requester
 * Validates that approval/rejection comes from the actual examinateur initial of the carcasse.
 */
export async function syncCarcasseModifRequest(
  body: Prisma.CarcasseModificationRequestUncheckedCreateInput,
  user: User
): Promise<SyncModifRequestResult> {
  if (!body.id) throw new Error('id manquant');
  if (!body.zacharie_carcasse_id) throw new Error('zacharie_carcasse_id manquant');

  const existing = await prisma.carcasseModificationRequest.findUnique({
    where: { id: body.id },
  });

  // -- CREATE -------------------------------------------------------------
  if (!existing) {
    const created = await prisma.carcasseModificationRequest.create({
      data: {
        ...body,
        is_synced: true,
      },
    });
    return { saved: created, isNew: true, transitionedTo: null };
  }

  // -- UPDATE -------------------------------------------------------------
  const incomingStatus = body.status as CarcasseModificationRequestStatus | undefined;
  const willTransition =
    !!incomingStatus &&
    existing.status === CarcasseModificationRequestStatus.PENDING &&
    incomingStatus !== CarcasseModificationRequestStatus.PENDING;

  if (willTransition) {
    // Only the examinateur initial of the underlying carcasse may approve/reject.
    const carcasse = await prisma.carcasse.findUnique({
      where: { zacharie_carcasse_id: existing.zacharie_carcasse_id },
    });
    if (!carcasse) throw new Error('Carcasse introuvable');
    if (carcasse.examinateur_initial_user_id !== user.id) {
      throw new Error("Seul l'examinateur initial peut approuver ou refuser une demande");
    }
  }

  const saved = await prisma.carcasseModificationRequest.update({
    where: { id: body.id },
    data: {
      ...body,
      is_synced: true,
    },
  });

  return {
    saved,
    isNew: false,
    transitionedTo: willTransition ? (incomingStatus as CarcasseModificationRequestStatus) : null,
  };
}

/**
 * Side-effects of a modifRequest sync. Runs after the row is saved.
 *   - on create: notify examinateur
 *   - on approve: mutate Carcasse; notify requester
 *   - on reject:  for NEW soft-delete Carcasse; notify requester
 * Returns the (possibly updated) Carcasse so the sync response can include it.
 */
export async function runCarcasseModifRequestSideEffects(
  result: SyncModifRequestResult,
  approvalPayload?: {
    examinateur_anomalies_carcasse?: string[];
    examinateur_anomalies_abats?: string[];
    examinateur_commentaire?: string | null;
    examinateur_carcasse_sans_anomalie?: boolean;
    examinateur_approbation_mise_sur_le_marche?: boolean;
  }
) {
  const { saved, isNew, transitionedTo } = result;

  if (isNew) {
    await notifyExaminateur(saved);
    return;
  }

  if (transitionedTo === CarcasseModificationRequestStatus.APPROVED) {
    if (saved.type === CarcasseModificationRequestType.BRACELET_RENAME) {
      await prisma.carcasse.update({
        where: { zacharie_carcasse_id: saved.zacharie_carcasse_id },
        data: { numero_bracelet: saved.numero_bracelet_after! },
      });
    } else if (saved.type === CarcasseModificationRequestType.NEW_CARCASSE) {
      await prisma.carcasse.update({
        where: { zacharie_carcasse_id: saved.zacharie_carcasse_id },
        data: {
          examinateur_anomalies_carcasse: approvalPayload?.examinateur_anomalies_carcasse ?? [],
          examinateur_anomalies_abats: approvalPayload?.examinateur_anomalies_abats ?? [],
          examinateur_commentaire: approvalPayload?.examinateur_commentaire ?? null,
          examinateur_carcasse_sans_anomalie: approvalPayload?.examinateur_carcasse_sans_anomalie ?? false,
          examinateur_signed_at: new Date(),
        },
      });
    }
    await notifyRequester(saved);
    return;
  }

  if (transitionedTo === CarcasseModificationRequestStatus.REJECTED) {
    if (saved.type === CarcasseModificationRequestType.NEW_CARCASSE) {
      await prisma.carcasse.update({
        where: { zacharie_carcasse_id: saved.zacharie_carcasse_id },
        data: { deleted_at: new Date() },
      });
    }
    await notifyRequester(saved);
    return;
  }
}

// --- Notifications ---------------------------------------------------------

async function notifyExaminateur(modif: CarcasseModificationRequest) {
  const carcasse = await prisma.carcasse.findUnique({
    where: { zacharie_carcasse_id: modif.zacharie_carcasse_id },
    include: { Fei: { include: { FeiExaminateurInitialUser: true } } },
  });
  const examinateur = carcasse?.Fei?.FeiExaminateurInitialUser;
  if (!examinateur) return;

  const requesterEntity = await prisma.entity.findUnique({
    where: { id: modif.requested_by_entity_id },
  });
  const entityName = requesterEntity?.nom_d_usage ?? 'Un intermédiaire';
  const chasseDate = carcasse?.Fei?.date_mise_a_mort
    ? dayjs(carcasse.Fei.date_mise_a_mort).format('DD/MM')
    : '';

  const title = chasseDate ? `Chasse du ${chasseDate}` : 'Demande de modification';
  const link = `${FRONTEND_URL}/app/chasseur/demandes-de-modification`;

  let body: string;
  if (modif.type === CarcasseModificationRequestType.BRACELET_RENAME) {
    body = `${entityName}, qui traite actuellement les carcasses de votre chasse du ${chasseDate}, signale un numéro de bracelet incorrect : ${modif.numero_bracelet_after} au lieu de ${modif.numero_bracelet_before}. Approuvez ou refusez : ${link}`;
  } else {
    body = `${entityName}, qui traite actuellement les carcasses de votre chasse du ${chasseDate}, signale une carcasse manquante (${carcasse?.espece ?? 'espèce non renseignée'}, bracelet ${carcasse?.numero_bracelet}). Signez l'examen ou refusez : ${link}`;
  }

  try {
    await sendNotificationToUser({
      user: examinateur,
      title,
      body,
      email: body,
      notificationLogAction: `MODIF_CREATED_${modif.id}`,
    });
  } catch (error) {
    capture(error as Error, { extra: { modifId: modif.id, examinateurId: examinateur.id } });
  }
}

async function notifyRequester(modif: CarcasseModificationRequest) {
  const requester = await prisma.user.findUnique({ where: { id: modif.requested_by_user_id } });
  if (!requester) return;

  const carcasse = await prisma.carcasse.findUnique({
    where: { zacharie_carcasse_id: modif.zacharie_carcasse_id },
    include: { Fei: { include: { FeiExaminateurInitialUser: true } } },
  });
  const examinateur = carcasse?.Fei?.FeiExaminateurInitialUser;
  const examinateurName = examinateur
    ? [examinateur.prenom, examinateur.nom_de_famille].filter(Boolean).join(' ')
    : "L'examinateur initial";
  const chasseDate = carcasse?.Fei?.date_mise_a_mort
    ? dayjs(carcasse.Fei.date_mise_a_mort).format('DD/MM/YYYY')
    : '';
  const commune = carcasse?.Fei?.commune_mise_a_mort ?? '';
  const bracelet = carcasse?.numero_bracelet ?? '';

  const approved = modif.status === CarcasseModificationRequestStatus.APPROVED;
  const title = bracelet ? `Carcasse numéro ${bracelet}` : 'Demande traitée';
  const action = approved ? 'approuvé' : 'refusé';
  const body = `${examinateurName} a ${action} votre demande sur la carcasse ${bracelet} de la chasse du ${chasseDate}${commune ? ` à ${commune}` : ''}.`;

  try {
    await sendNotificationToUser({
      user: requester,
      title,
      body,
      email: body,
      notificationLogAction: `MODIF_${modif.status}_${modif.id}`,
    });
  } catch (error) {
    capture(error as Error, { extra: { modifId: modif.id, requesterId: requester.id } });
  }
}
