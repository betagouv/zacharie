import prisma from '~/prisma';
import {
  CarcasseModificationRequestStatus,
  CarcasseModificationRequestType,
  Prisma,
  type CarcasseModificationRequest,
  type User,
} from '@prisma/client';
import sendNotificationToUser, { type PushWording } from '~/service/notifications';
import { capture } from '~/third-parties/sentry';
import type { SyncScope } from '~/utils/sync-scope';
import dayjs from 'dayjs';
import { SyncRejectedError } from '~/utils/sync-errors';
import { nextVersion } from '~/utils/sync-version';

const FRONTEND_URL = 'https://zacharie.beta.gouv.fr';

export type SyncModifRequestResult = {
  saved: CarcasseModificationRequest;
  isNew: boolean;
  transitionedTo: CarcasseModificationRequestStatus | null;
  justCancelled: boolean;
};

export async function syncCarcasseModifRequest(
  body: Prisma.CarcasseModificationRequestUncheckedCreateInput,
  user: User,
  scope: SyncScope
): Promise<SyncModifRequestResult> {
  if (!body.id) throw new Error('id manquant');
  if (!body.zacharie_carcasse_id) throw new Error('zacharie_carcasse_id manquant');

  const existing = await prisma.carcasseModificationRequest.findUnique({
    where: { id: body.id },
  });

  const zacharieCarcasseId = existing?.zacharie_carcasse_id ?? body.zacharie_carcasse_id;
  if (!(await scope.canWriteCarcasse(zacharieCarcasseId))) {
    throw new SyncRejectedError("Vous n'avez pas accès à cette carcasse");
  }

  if (!existing) {
    if (!Object.values(CarcasseModificationRequestType).includes(body.type)) {
      throw new SyncRejectedError('Type de demande inconnu');
    }
    const carcasse = await prisma.carcasse.findUnique({
      where: { zacharie_carcasse_id: zacharieCarcasseId },
      select: { fei_numero: true, numero_bracelet: true, created_by_user_id: true },
    });
    if (!carcasse) throw new Error('Carcasse introuvable');
    if (!body.requested_by_entity_id || !scope.entityIds.includes(body.requested_by_entity_id)) {
      throw new SyncRejectedError('Vous ne pouvez pas agir au nom de cette entité');
    }
    if (
      body.type === CarcasseModificationRequestType.NEW_CARCASSE &&
      carcasse.created_by_user_id !== user.id
    ) {
      throw new SyncRejectedError(
        "Vous ne pouvez déclarer comme ajoutée qu'une carcasse que vous avez créée"
      );
    }
    const isRename = body.type === CarcasseModificationRequestType.BRACELET_RENAME;
    const numeroBraceletBefore =
      carcasse.created_by_user_id === user.id
        ? (body.numero_bracelet_before ?? carcasse.numero_bracelet)
        : carcasse.numero_bracelet;
    const isCancelled = !!body.deleted_at;
    const created = await prisma.carcasseModificationRequest.create({
      data: {
        id: body.id,
        type: body.type,
        zacharie_carcasse_id: zacharieCarcasseId,
        fei_numero: carcasse.fei_numero,
        requested_by_user_id: user.id,
        requested_by_entity_id: body.requested_by_entity_id,
        requested_at: body.requested_at ?? undefined,
        comment_intermediaire: body.comment_intermediaire ?? null,
        numero_bracelet_before: isRename ? numeroBraceletBefore : null,
        numero_bracelet_after: isRename ? (body.numero_bracelet_after ?? null) : null,
        status: CarcasseModificationRequestStatus.PENDING,
        created_at: body.created_at ?? undefined,
        deleted_at: isCancelled ? body.deleted_at : null,
        is_synced: true,
      },
    });
    const renameNow =
      !isCancelled &&
      created.type === CarcasseModificationRequestType.BRACELET_RENAME &&
      !!created.numero_bracelet_after;
    await prisma.carcasse.update({
      where: { zacharie_carcasse_id: created.zacharie_carcasse_id },
      data: {
        updated_at: new Date(),
        ...(renameNow ? { numero_bracelet: created.numero_bracelet_after!, ...nextVersion(user.id) } : {}),
      },
    });
    return { saved: created, isNew: true, transitionedTo: null, justCancelled: false };
  }

  const incomingStatus = body.status as CarcasseModificationRequestStatus | undefined;
  const willTransition =
    !!incomingStatus &&
    existing.status === CarcasseModificationRequestStatus.PENDING &&
    incomingStatus !== CarcasseModificationRequestStatus.PENDING;

  const incomingDeletedAt = body.deleted_at as Date | string | null | undefined;
  const justCancelled =
    !existing.deleted_at &&
    !!incomingDeletedAt &&
    existing.status === CarcasseModificationRequestStatus.PENDING;

  if (willTransition) {
    const carcasse = await prisma.carcasse.findUnique({
      where: { zacharie_carcasse_id: existing.zacharie_carcasse_id },
    });
    if (!carcasse) throw new Error('Carcasse introuvable');
    if (carcasse.examinateur_initial_user_id !== user.id) {
      throw new SyncRejectedError("Seul l'examinateur initial peut approuver ou refuser une demande");
    }
  }

  if (justCancelled && existing.requested_by_user_id !== user.id) {
    throw new SyncRejectedError("Seul l'auteur de la demande peut l'annuler");
  }

  const saved = await prisma.carcasseModificationRequest.update({
    where: { id: body.id },
    data: {
      ...(justCancelled ? { deleted_at: incomingDeletedAt } : {}),
      ...(willTransition
        ? {
            status: incomingStatus,
            reviewed_by_user_id: user.id,
            reviewed_at: new Date(),
            rejection_reason:
              incomingStatus === CarcasseModificationRequestStatus.REJECTED
                ? (body.rejection_reason ?? null)
                : null,
          }
        : {}),
      is_synced: true,
    },
  });
  await prisma.carcasse.update({
    where: { zacharie_carcasse_id: existing.zacharie_carcasse_id },
    data: {
      updated_at: new Date(),
    },
  });

  return {
    saved,
    isNew: false,
    transitionedTo: willTransition ? (incomingStatus as CarcasseModificationRequestStatus) : null,
    justCancelled,
  };
}

async function isCarcasseFrozenBySvi(zacharieCarcasseId: string): Promise<boolean> {
  const carcasse = await prisma.carcasse.findUnique({
    where: { zacharie_carcasse_id: zacharieCarcasseId },
    select: {
      svi_ipm1_signed_at: true,
      svi_ipm2_signed_at: true,
      svi_closed_at: true,
      svi_automatic_closed_at: true,
    },
  });
  if (!carcasse) return true;
  return !!(
    carcasse.svi_ipm1_signed_at ||
    carcasse.svi_ipm2_signed_at ||
    carcasse.svi_closed_at ||
    carcasse.svi_automatic_closed_at
  );
}

export async function runCarcasseModifRequestSideEffects(
  result: SyncModifRequestResult,
  user: User,
  approvalPayload?: {
    examinateur_anomalies_carcasse?: string[];
    examinateur_anomalies_abats?: string[];
    examinateur_commentaire?: string | null;
    examinateur_carcasse_sans_anomalie?: boolean;
    examinateur_approbation_mise_sur_le_marche?: boolean;
  }
) {
  const { saved, isNew, transitionedTo, justCancelled } = result;

  if (isNew) {
    if (!saved.deleted_at) await notifyExaminateur(saved);
    return;
  }

  if (justCancelled) {
    if (await isCarcasseFrozenBySvi(saved.zacharie_carcasse_id)) return;
    if (saved.type === CarcasseModificationRequestType.NEW_CARCASSE) {
      await prisma.carcasse.update({
        where: { zacharie_carcasse_id: saved.zacharie_carcasse_id },
        data: { deleted_at: new Date(), ...nextVersion(user.id) },
      });
    } else if (saved.numero_bracelet_before) {
      await prisma.carcasse.update({
        where: { zacharie_carcasse_id: saved.zacharie_carcasse_id },
        data: { numero_bracelet: saved.numero_bracelet_before, ...nextVersion(user.id) },
      });
    }
    return;
  }

  if (transitionedTo === CarcasseModificationRequestStatus.APPROVED) {
    if (saved.type === CarcasseModificationRequestType.NEW_CARCASSE) {
      await prisma.carcasse.update({
        where: { zacharie_carcasse_id: saved.zacharie_carcasse_id },
        data: {
          examinateur_anomalies_carcasse: approvalPayload?.examinateur_anomalies_carcasse ?? [],
          examinateur_anomalies_abats: approvalPayload?.examinateur_anomalies_abats ?? [],
          examinateur_commentaire: approvalPayload?.examinateur_commentaire ?? null,
          examinateur_carcasse_sans_anomalie: approvalPayload?.examinateur_carcasse_sans_anomalie ?? false,
          examinateur_signed_at: new Date(),
          ...nextVersion(user.id),
        },
      });
    }
    await notifyRequester(saved);
    return;
  }

  if (transitionedTo === CarcasseModificationRequestStatus.REJECTED) {
    if (saved.type === CarcasseModificationRequestType.NEW_CARCASSE) {
      if (!(await isCarcasseFrozenBySvi(saved.zacharie_carcasse_id))) {
        await prisma.carcasse.update({
          where: { zacharie_carcasse_id: saved.zacharie_carcasse_id },
          data: { deleted_at: new Date(), ...nextVersion(user.id) },
        });
      }
    }
    await notifyRequester(saved);
    return;
  }
}

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
  const entityName = requesterEntity?.nom_d_usage ?? 'Un destinataire de vos carcasses';
  const chasseDate = carcasse?.Fei?.date_mise_a_mort
    ? dayjs(carcasse.Fei.date_mise_a_mort).format('DD/MM')
    : '';

  const title = chasseDate ? `Chasse du ${chasseDate}` : 'Demande de modification';
  const link = `${FRONTEND_URL}/app/chasseur/demandes-de-modification`;

  let body: string;
  let push: PushWording;
  if (modif.type === CarcasseModificationRequestType.BRACELET_RENAME) {
    body = `${entityName}, qui traite actuellement les carcasses de votre chasse du ${chasseDate}, a corrigé un numéro de marquage : ${modif.numero_bracelet_after} au lieu de ${modif.numero_bracelet_before}. La correction est déjà prise en compte et la carcasse continue son parcours. Pour la consulter : ${link}`;
    push = {
      title: `Correction sur votre chasse du ${chasseDate}`,
      body: `${entityName} a corrigé un numéro de marquage : ${modif.numero_bracelet_after} au lieu de ${modif.numero_bracelet_before}.`,
    };
  } else {
    body = `${entityName}, qui traite actuellement les carcasses de votre chasse du ${chasseDate}, a ajouté une carcasse manquante (${carcasse?.espece ?? 'espèce non renseignée'}, marquage ${carcasse?.numero_bracelet}). Elle suit déjà son parcours ; il vous reste à signer son examen initial quand vous le pourrez : ${link}`;
    push = {
      title: `Correction sur votre chasse du ${chasseDate}`,
      body: `${entityName} a ajouté une carcasse (${carcasse?.espece ?? 'espèce non renseignée'}, marquage ${carcasse?.numero_bracelet}) : examen initial à signer.`,
    };
  }

  try {
    await sendNotificationToUser({
      user: examinateur,
      title,
      email: body,
      push,
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
  const isRename = modif.type === CarcasseModificationRequestType.BRACELET_RENAME;
  const title = bracelet ? `Carcasse numéro ${bracelet}` : 'Demande traitée';
  const chasse = `la chasse du ${chasseDate}${commune ? ` à ${commune}` : ''}`;
  let body: string;
  if (isRename) {
    body = approved
      ? `${examinateurName} a confirmé le numéro de marquage ${bracelet} que vous avez corrigé sur ${chasse}.`
      : `${examinateurName} conteste le numéro de marquage ${bracelet} que vous avez corrigé sur ${chasse}. Le numéro reste celui que vous avez relevé : vérifiez-le sur la carcasse.${modif.rejection_reason ? ` Motif : ${modif.rejection_reason}` : ''}`;
  } else {
    body = approved
      ? `${examinateurName} a signé l'examen initial de la carcasse ${bracelet} que vous avez ajoutée sur ${chasse}.`
      : `${examinateurName} a refusé la carcasse ${bracelet} que vous avez ajoutée sur ${chasse}.${modif.rejection_reason ? ` Motif : ${modif.rejection_reason}` : ''}`;
  }

  try {
    await sendNotificationToUser({
      user: requester,
      title,
      email: body,
      push: { title: bracelet ? `Carcasse n°${bracelet}` : 'Demande traitée', body },
      notificationLogAction: `MODIF_${modif.status}_${modif.id}`,
    });
  } catch (error) {
    capture(error as Error, { extra: { modifId: modif.id, requesterId: requester.id } });
  }
}
