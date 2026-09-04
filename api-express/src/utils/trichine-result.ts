import z from 'zod';
import {
  EntityTypes,
  TrichineResultatAnalyse,
  TrichineStatutLogistiqueFTP,
  TrichineType,
  type TrichinePool,
} from '@prisma/client';
import prisma from '~/prisma';
import { archiveFtpPdf } from '~/utils/trichine-ftp-document';
import { capture } from '~/third-parties/sentry';
import {
  getFtpEmitterUsers,
  getUsersWorkingForEntity,
  logTrichineStatutChange,
  nextFTPReference,
  notifyTrichineUsers,
  TrichineNotificationType,
  TrichineObjetType,
  withReferenceRetry,
  type TrichineNotifiableUser,
} from '~/utils/trichine';
import { recomputeFTPTrichine, recomputePoolAndLinkedFTPs } from '~/utils/trichine-status';

// Résultats saisissables selon le type de laboratoire (cf doc/trichine.md §6.3-6.4)
export const LVD_RESULTS: TrichineResultatAnalyse[] = [
  TrichineResultatAnalyse.NEGATIF,
  TrichineResultatAnalyse.DOUTEUX,
];
export const LNR_RESULTS: TrichineResultatAnalyse[] = [
  TrichineResultatAnalyse.NON_NEGATIF,
  TrichineResultatAnalyse.PRESENCE_PARASITE_NON_IDENTIFIE,
  TrichineResultatAnalyse.POSITIF,
];

export type ResultValidationError = {
  code: 'not_allowed' | 'parasite_required' | 'already_resulted';
  status: number;
  error: string;
};

/**
 * Règles métier de saisie d'un résultat sur un pool : résultat autorisé selon LVD/LNR, parasite
 * obligatoire sur NON_NEGATIF, écrasement d'un DOUTEUX réservé au LNR. Pur, sans I/O.
 * Source UNIQUE partagée par applyPoolResult (saisie/import) et l'aperçu d'import LIMS.
 */
export function validateResultForPool({
  existingResult,
  resultat_analyse,
  parasite_identifie,
  isLnr,
}: {
  existingResult: TrichineResultatAnalyse | null;
  resultat_analyse: TrichineResultatAnalyse;
  parasite_identifie?: string;
  isLnr: boolean;
}): ResultValidationError | null {
  const allowed = isLnr ? LNR_RESULTS : LVD_RESULTS;
  if (!allowed.includes(resultat_analyse)) {
    return {
      code: 'not_allowed',
      status: 400,
      error: `Résultat non autorisé pour votre laboratoire : ${resultat_analyse}`,
    };
  }
  if (resultat_analyse === TrichineResultatAnalyse.NON_NEGATIF && !parasite_identifie) {
    return {
      code: 'parasite_required',
      status: 400,
      error: 'Le parasite identifié est obligatoire pour un résultat non négatif',
    };
  }
  // Seul le LNR peut écraser un résultat DOUTEUX (confirmation) ; tout autre résultat est définitif
  if (existingResult && !(existingResult === TrichineResultatAnalyse.DOUTEUX && isLnr)) {
    return { code: 'already_resulted', status: 400, error: 'Un résultat a déjà été saisi pour ce pool' };
  }
  return null;
}

// Formes minimales attendues (satisfaites structurellement par findPoolForLabo côté saisie
// manuelle et par le rapprochement d'import LIMS côté fichier)
type ApplyPoolResultPool = {
  id: string;
  reference_pool: string;
  resultat_analyse: TrichineResultatAnalyse | null;
  date_debut_analyse: Date | null;
  commentaire: string | null;
  TrichineEchantillons: Array<{
    Carcasse: {
      premier_detenteur_user_id: string | null;
      current_owner_user_id: string | null;
      current_owner_entity_id: string | null;
    };
  }>;
};

type ApplyPoolResultFtp = {
  id: string;
  destinataire_entity_id: string;
  ftp_parent_id: string | null;
  expediteur_user_id: string;
  expediteur_entity_id: string | null;
};

// Lien pool ↔ FTP par lequel le pool est arrivé dans le laboratoire qui saisit : c'est lui qui
// porte la référence interne de ce laboratoire.
type ApplyPoolResultLink = {
  id: string;
};

export const resultatSchema = z.object({
  resultat_analyse: z.enum(
    Object.values(TrichineResultatAnalyse) as [TrichineResultatAnalyse, ...TrichineResultatAnalyse[]]
  ),
  parasite_identifie: z.string().optional(),
  date_debut_analyse: z.coerce.date().optional(),
  date_fin_analyse: z.coerce.date().optional(),
  reference_labo: z.string().optional(),
  commentaire: z.string().optional(),
});
export type ApplyPoolResultBody = z.infer<typeof resultatSchema>;

// Discriminant string-literal (et non booléen) : le repo compile avec strictNullChecks: false,
// qui casse le narrowing des unions discriminées sur un booléen.
export type ApplyPoolResultOutcome =
  | { kind: 'ok'; pool: TrichinePool | null }
  | { kind: 'error'; status: number; error: string };

/**
 * Applique un résultat d'analyse à un pool : gardes métier (résultats autorisés selon
 * LVD/LNR, parasite obligatoire sur NON_NEGATIF, écrasement d'un DOUTEUX réservé au LNR),
 * mise à jour du pool, recalcul de statut, génération automatique de la FTP de confirmation
 * vers le LNR sur DOUTEUX, et notifications.
 *
 * Chemin UNIQUE partagé par la saisie manuelle (POST /laboratoire/pool/:id/resultat) et
 * l'import de fichier LIMS : toute évolution des règles/effets de bord profite aux deux.
 * Les préoccupations HTTP (auth, parsing, rapprochement du pool, réponse) restent aux appelants.
 */
export async function applyPoolResult({
  pool,
  ftp,
  link,
  body,
  userId,
  isLnr,
}: {
  pool: ApplyPoolResultPool;
  ftp: ApplyPoolResultFtp;
  link: ApplyPoolResultLink;
  body: ApplyPoolResultBody;
  userId: string;
  isLnr: boolean;
}): Promise<ApplyPoolResultOutcome> {
  if (!body.resultat_analyse) {
    return { kind: 'error', status: 400, error: 'Le résultat est obligatoire' };
  }
  const invalid = validateResultForPool({
    existingResult: pool.resultat_analyse,
    resultat_analyse: body.resultat_analyse,
    parasite_identifie: body.parasite_identifie,
    isLnr,
  });
  if (invalid) {
    return { kind: 'error', status: invalid.status, error: invalid.error };
  }

  await prisma.trichinePool.update({
    where: { id: pool.id },
    data: {
      resultat_analyse: body.resultat_analyse,
      parasite_identifie: body.parasite_identifie ?? null,
      date_debut_analyse: body.date_debut_analyse ?? pool.date_debut_analyse,
      date_fin_analyse: body.date_fin_analyse ?? new Date(),
      commentaire: body.commentaire ?? pool.commentaire,
    },
  });
  if (body.reference_labo) {
    await prisma.trichinePoolFTP.update({
      where: { id: link.id },
      data: { reference_labo: body.reference_labo },
    });
  }
  await logTrichineStatutChange({
    objetType: TrichineObjetType.POOL,
    objetId: pool.id,
    ancienStatut: pool.resultat_analyse,
    nouveauStatut: body.resultat_analyse,
    userId,
    commentaire: 'resultat_analyse',
  });
  await recomputePoolAndLinkedFTPs(pool.id, userId);

  // Un résultat n'est notifié qu'à l'émetteur de la FTP. Les détenteurs des carcasses ne le sont
  // pas : ils voient le résultat sur la carcasse, et le volume d'envois reste à cadrer avec eux.
  const emitterUsers = await getFtpEmitterUsers(ftp);

  if (body.resultat_analyse === TrichineResultatAnalyse.NEGATIF) {
    await notifyTrichineUsers({
      users: emitterUsers,
      type: TrichineNotificationType.RESULTAT_ANALYSE,
      objetType: TrichineObjetType.POOL,
      objetId: pool.id,
      title: `Résultat négatif — pool ${pool.reference_pool}`,
      message: `Le laboratoire a rendu un résultat négatif (pas de trichine) pour le pool ${pool.reference_pool}. Les carcasses associées peuvent être commercialisées.`,
      notificationLogAction: `TRICHINE_RESULTAT_${pool.reference_pool}_NEGATIF`,
    });
  }

  if (body.resultat_analyse === TrichineResultatAnalyse.DOUTEUX) {
    // Type ré-attribué automatiquement : le pool transmis au LNR devient un pool de confirmation
    await prisma.trichinePool.update({
      where: { id: pool.id },
      data: { type: TrichineType.CONFIRMATION },
    });
    await prisma.trichineEchantillon.updateMany({
      where: { pool_id: pool.id, deleted_at: null },
      data: { type: TrichineType.CONFIRMATION },
    });

    // Génération automatique de la FTP vers le LNR
    const lnrEntity = await prisma.entity.findFirst({
      where: { type: EntityTypes.LABORATOIRE, is_lnr: true, deleted_at: null },
    });
    if (!lnrEntity) {
      capture(new Error('Trichine : aucun LNR seedé, FTP de confirmation non générée'), {
        extra: { pool_id: pool.id },
      });
    } else {
      const lnrFtp = await withReferenceRetry(async () =>
        prisma.trichineFTP.create({
          data: {
            numero_fiche: await nextFTPReference(),
            expediteur_user_id: userId,
            expediteur_entity_id: ftp.destinataire_entity_id,
            destinataire_entity_id: lnrEntity.id,
            ftp_parent_id: ftp.id,
            statut_logistique: TrichineStatutLogistiqueFTP.ENVOYEE,
            date_envoi: new Date(),
            commentaire: `Confirmation LNR du pool ${pool.reference_pool} (résultat douteux)`,
          },
        })
      );
      await prisma.trichinePoolFTP.create({ data: { pool_id: pool.id, ftp_id: lnrFtp.id } });
      // Statut analytique de la FTP de confirmation (EN_COURS_ANALYSES)
      await recomputeFTPTrichine(lnrFtp.id, userId);
      await logTrichineStatutChange({
        objetType: TrichineObjetType.FTP,
        objetId: lnrFtp.id,
        ancienStatut: null,
        nouveauStatut: lnrFtp.statut_logistique,
        userId,
        commentaire: `FTP générée automatiquement vers le LNR pour le pool ${pool.reference_pool}`,
      });
      const lnrUsers = await getUsersWorkingForEntity(lnrEntity.id);
      const lnrPdf = await archiveFtpPdf(lnrFtp.id, userId);
      await notifyTrichineUsers({
        users: lnrUsers,
        type: TrichineNotificationType.FTP_RECUE,
        objetType: TrichineObjetType.FTP,
        objetId: lnrFtp.id,
        title: `Pool douteux à confirmer — FTP ${lnrFtp.numero_fiche}`,
        message: `Un laboratoire vous a transmis le pool ${pool.reference_pool} (résultat douteux) pour confirmation via la FTP ${lnrFtp.numero_fiche}.`,
        notificationLogAction: `TRICHINE_FTP_ENVOYEE_${lnrFtp.numero_fiche}`,
        attachments: lnrPdf
          ? [{ content: lnrPdf.toString('base64'), name: `FTP-${lnrFtp.numero_fiche}.pdf` }]
          : undefined,
      });
    }

    await notifyTrichineUsers({
      users: emitterUsers,
      type: TrichineNotificationType.RESULTAT_ANALYSE,
      objetType: TrichineObjetType.POOL,
      objetId: pool.id,
      title: `Résultat douteux — pool ${pool.reference_pool}`,
      message: `Le laboratoire a détecté une larve dans le pool ${pool.reference_pool}. Une confirmation par le LNR est en cours. Vous pouvez réaliser des prélèvements de 2e intention pour identifier la carcasse incriminée.`,
      notificationLogAction: `TRICHINE_RESULTAT_${pool.reference_pool}_DOUTEUX`,
    });
  }

  if (LNR_RESULTS.includes(body.resultat_analyse)) {
    // Résultat de confirmation LNR : alerte au LVD (expéditeur de la FTP de confirmation)
    // + à l'émetteur initial (expéditeur de la FTP d'origine) + aux détenteurs des carcasses
    const recipients = new Map<string, TrichineNotifiableUser>();
    for (const user of emitterUsers) recipients.set(user.id, user);
    if (ftp.ftp_parent_id) {
      const parentFtp = await prisma.trichineFTP.findUnique({ where: { id: ftp.ftp_parent_id } });
      if (parentFtp) {
        for (const user of await getFtpEmitterUsers(parentFtp)) recipients.set(user.id, user);
      }
    }

    const messages: Partial<Record<TrichineResultatAnalyse, string>> = {
      [TrichineResultatAnalyse.POSITIF]: `ALERTE SANITAIRE — Le LNR a confirmé la présence de trichine dans le pool ${pool.reference_pool}. Les carcasses concernées sont impropres à la consommation et doivent être retirées / saisies.`,
      [TrichineResultatAnalyse.NON_NEGATIF]: `Le LNR a identifié un parasite autre que la trichine (${body.parasite_identifie}) dans le pool ${pool.reference_pool}. Une décision est à prendre sur les carcasses concernées.`,
      [TrichineResultatAnalyse.PRESENCE_PARASITE_NON_IDENTIFIE]: `Le LNR a détecté un parasite non identifié dans le pool ${pool.reference_pool}. Une décision est à prendre sur les carcasses concernées.`,
    };
    await notifyTrichineUsers({
      users: [...recipients.values()],
      type: TrichineNotificationType.RESULTAT_ANALYSE,
      objetType: TrichineObjetType.POOL,
      objetId: pool.id,
      title: `Résultat LNR — pool ${pool.reference_pool}`,
      message: messages[body.resultat_analyse]!,
      notificationLogAction: `TRICHINE_RESULTAT_${pool.reference_pool}_${body.resultat_analyse}`,
      excludeUserIds: [userId],
    });
  }

  const updatedPool = await prisma.trichinePool.findUnique({ where: { id: pool.id } });
  return { kind: 'ok', pool: updatedPool };
}
