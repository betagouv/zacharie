import z from 'zod';
import dayjs from 'dayjs';
import {
  EntityTypes,
  TrichineAliasObjet,
  TrichineResultatAnalyse,
  TrichineStatutLogistiqueFTP,
  TrichineType,
  type TrichinePool,
} from '@prisma/client';
import prisma from '~/prisma';
import { avecNombreLarves } from '~/prisma-omit';
import { archiveFtpPdf } from '~/utils/trichine-ftp-document';
import { capture } from '~/third-parties/sentry';
import {
  getFtpEmitterUsers,
  getUsersWorkingForEntity,
  logTrichineStatutChange,
  nextFTPReference,
  referenceCodeForEntity,
  notifyTrichineUsers,
  TrichineNotificationType,
  TrichineObjetType,
  withReferenceRetry,
  type TrichineNotifiableUser,
} from '~/utils/trichine';
import type { TrichineEmailContent } from '~/templates/trichine-email';
import type { PoolResultEffet } from '~/types/responses';
import {
  ALIAS_REFERENCE_CONFLIT,
  aliasReferenceRefusee,
  deleteAlias,
  upsertAlias,
} from '~/utils/trichine-alias';
import { recomputeFTPTrichine, recomputePoolAndLinkedFTPs } from '~/utils/trichine-status';

export const LVD_RESULTS: TrichineResultatAnalyse[] = [
  TrichineResultatAnalyse.NEGATIF,
  TrichineResultatAnalyse.DOUTEUX,
];
export const LNR_RESULTS: TrichineResultatAnalyse[] = [
  TrichineResultatAnalyse.NON_NEGATIF,
  TrichineResultatAnalyse.PRESENCE_PARASITE_NON_IDENTIFIE,
  TrichineResultatAnalyse.POSITIF,
];

export const RESULTATS_AVEC_LARVES: TrichineResultatAnalyse[] = [
  TrichineResultatAnalyse.DOUTEUX,
  ...LNR_RESULTS,
];

export type ResultValidationError = {
  code: 'not_allowed' | 'parasite_required' | 'larves_not_allowed' | 'dates_invalides' | 'already_resulted';
  status: number;
  error: string;
};

export function validateResultForPool({
  existingResult,
  resultat_analyse,
  parasite_identifie,
  nombre_larves,
  date_debut_analyse,
  date_fin_analyse,
  isLnr,
}: {
  existingResult: TrichineResultatAnalyse | null;
  resultat_analyse: TrichineResultatAnalyse;
  parasite_identifie?: string;
  nombre_larves?: number;
  date_debut_analyse?: Date | string;
  date_fin_analyse?: Date | string;
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
      error: 'Le parasite identifié est obligatoire pour un résultat « autre parasite identifié »',
    };
  }
  if (nombre_larves != null && !RESULTATS_AVEC_LARVES.includes(resultat_analyse)) {
    return {
      code: 'larves_not_allowed',
      status: 400,
      error: 'Le nombre de larves ne s’indique que sur un résultat non négatif',
    };
  }
  const datesInvalides = erreurDatesAnalyse(date_debut_analyse, date_fin_analyse);
  if (datesInvalides) {
    return { code: 'dates_invalides', status: 400, error: datesInvalides };
  }
  if (existingResult && !(existingResult === TrichineResultatAnalyse.DOUTEUX && isLnr)) {
    return { code: 'already_resulted', status: 400, error: 'Un résultat a déjà été saisi pour ce pool' };
  }
  return null;
}

function erreurDatesAnalyse(debut?: Date | string, fin?: Date | string): string | null {
  const limite = dayjs().add(1, 'day');
  if ((debut && dayjs(debut).isAfter(limite)) || (fin && dayjs(fin).isAfter(limite))) {
    return 'Une date d’analyse ne peut pas être dans le futur';
  }
  if (debut && fin && dayjs(debut).isAfter(dayjs(fin))) {
    return 'La date de début d’analyse doit précéder la date de fin';
  }
  return null;
}

type ApplyPoolResultPool = {
  id: string;
  reference_pool: string;
  resultat_analyse: TrichineResultatAnalyse | null;
  nombre_larves_lvd: number | null;
  nombre_larves_lnr: number | null;
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
  numero_fiche: string;
  destinataire_entity_id: string;
  ftp_parent_id: string | null;
  expediteur_user_id: string;
  expediteur_entity_id: string | null;
};

export function detailsNombreLarves({
  nombre_larves_lvd,
  nombre_larves_lnr,
}: {
  nombre_larves_lvd?: number | null;
  nombre_larves_lnr?: number | null;
}): Array<{ label: string; value: string }> {
  return [
    ...(nombre_larves_lvd != null
      ? [{ label: 'Larves comptées par le laboratoire agréé', value: String(nombre_larves_lvd) }]
      : []),
    ...(nombre_larves_lnr != null
      ? [{ label: 'Larves comptées par le LNR', value: String(nombre_larves_lnr) }]
      : []),
  ];
}

export const resultatSchema = z.object({
  resultat_analyse: z.enum(
    Object.values(TrichineResultatAnalyse) as [TrichineResultatAnalyse, ...TrichineResultatAnalyse[]]
  ),
  parasite_identifie: z.string().optional(),
  nombre_larves: z.number().int().min(1).optional(),
  date_debut_analyse: z.coerce.date().optional(),
  date_fin_analyse: z.coerce.date().optional(),
  reference_labo: z.string().optional(),
  commentaire: z.string().optional(),
  date_envoi_lnr: z.coerce.date().optional(),
  mode_transport_lnr: z.string().optional(),
  conditions_conservation_lnr: z.string().optional(),
});
export type ApplyPoolResultBody = z.infer<typeof resultatSchema>;

export type ApplyPoolResultOrigine = 'saisie' | 'automatique';

export type FtpConfirmation = { id: string; numero_fiche: string };

export type ApplyPoolResultOutcome =
  | {
      kind: 'ok';
      pool: TrichinePool | null;
      ftpConfirmation: FtpConfirmation | null;
      referenceIgnoree: string | null;
    }
  | { kind: 'error'; status: number; error: string };

export async function applyPoolResult({
  pool,
  ftp,
  body,
  userId,
  isLnr,
  origine,
}: {
  pool: ApplyPoolResultPool;
  ftp: ApplyPoolResultFtp;
  body: ApplyPoolResultBody;
  userId: string;
  isLnr: boolean;
  origine: ApplyPoolResultOrigine;
}): Promise<ApplyPoolResultOutcome> {
  if (!body.resultat_analyse) {
    return { kind: 'error', status: 400, error: 'Le résultat est obligatoire' };
  }
  const invalid = validateResultForPool({
    existingResult: pool.resultat_analyse,
    resultat_analyse: body.resultat_analyse,
    parasite_identifie: body.parasite_identifie,
    nombre_larves: body.nombre_larves,
    date_debut_analyse: body.date_debut_analyse,
    date_fin_analyse: body.date_fin_analyse,
    isLnr,
  });
  if (invalid) {
    return { kind: 'error', status: invalid.status, error: invalid.error };
  }
  const versLnr = body.resultat_analyse === TrichineResultatAnalyse.DOUTEUX && !isLnr;
  if (versLnr && origine === 'saisie') {
    if (body.nombre_larves == null) {
      return { kind: 'error', status: 400, error: 'Le nombre de larves est obligatoire pour un non négatif' };
    }
    if (!body.conditions_conservation_lnr?.trim()) {
      return {
        kind: 'error',
        status: 400,
        error:
          'Les conditions de conservation de l’élément parasitaire sont obligatoires pour un non négatif',
      };
    }
  }
  const referenceSaisie = body.reference_labo?.trim() || null;
  const referenceRefusee = referenceSaisie
    ? await aliasReferenceRefusee({
        entityId: ftp.destinataire_entity_id,
        objetType: TrichineAliasObjet.POOL,
        objetId: pool.id,
        reference: referenceSaisie,
      })
    : null;
  if (referenceRefusee && origine === 'saisie') {
    return { kind: 'error', status: 400, error: referenceRefusee };
  }
  const referenceLabo = referenceRefusee ? null : referenceSaisie;
  let referenceIgnoree = referenceRefusee;
  const referenceEffacee = origine === 'saisie' && body.reference_labo !== undefined && !referenceSaisie;
  const nombreLarves = body.nombre_larves ?? (isLnr ? pool.nombre_larves_lnr : pool.nombre_larves_lvd);

  await prisma.trichinePool.update({
    where: { id: pool.id },
    data: {
      resultat_analyse: body.resultat_analyse,
      parasite_identifie: body.parasite_identifie ?? null,
      ...(isLnr ? { nombre_larves_lnr: nombreLarves } : { nombre_larves_lvd: nombreLarves }),
      date_debut_analyse: body.date_debut_analyse ?? pool.date_debut_analyse,
      date_fin_analyse: body.date_fin_analyse ?? new Date(),
      commentaire: body.commentaire ?? pool.commentaire,
    },
  });
  if (referenceLabo) {
    const aliasOutcome = await upsertAlias({
      entityId: ftp.destinataire_entity_id,
      objetType: TrichineAliasObjet.POOL,
      objetId: pool.id,
      reference: referenceLabo,
    });
    if (aliasOutcome.kind === 'conflit') referenceIgnoree = ALIAS_REFERENCE_CONFLIT;
  }
  if (referenceEffacee) {
    await deleteAlias({
      entityId: ftp.destinataire_entity_id,
      objetType: TrichineAliasObjet.POOL,
      objetId: pool.id,
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

  let ftpConfirmation: FtpConfirmation | null = null;

  const emitterUsers = await getFtpEmitterUsers(ftp);

  if (body.resultat_analyse === TrichineResultatAnalyse.NEGATIF) {
    await notifyTrichineUsers({
      users: emitterUsers,
      type: TrichineNotificationType.RESULTAT_ANALYSE,
      objetType: TrichineObjetType.POOL,
      objetId: pool.id,
      title: `Résultat négatif — pool ${pool.reference_pool}`,
      message: `Le laboratoire a rendu un résultat négatif (pas de trichine) pour le pool ${pool.reference_pool}. Les carcasses associées peuvent être commercialisées.`,
      email: {
        subject: `Résultat négatif · pool ${pool.reference_pool}`,
        tone: 'success',
        badge: 'Résultat négatif',
        heading: 'Pas de trichine détectée',
        intro: `Bonne nouvelle : le laboratoire n’a détecté aucune larve de trichine dans le pool ${pool.reference_pool}.`,
        details: [
          { label: 'Pool', value: pool.reference_pool },
          { label: 'Fiche de transmission', value: ftp.numero_fiche },
        ],
        actions: [
          'Les carcasses de ce pool peuvent être commercialisées, sous réserve des autres contrôles sanitaires.',
          'Aucune autre action n’est requise côté trichine.',
        ],
      },
      notificationLogAction: `TRICHINE_RESULTAT_${pool.reference_pool}_NEGATIF`,
    });
  }

  if (body.resultat_analyse === TrichineResultatAnalyse.DOUTEUX) {
    await prisma.trichinePool.update({
      where: { id: pool.id },
      data: { type: TrichineType.CONFIRMATION },
    });
    await prisma.trichineEchantillon.updateMany({
      where: { pool_id: pool.id, deleted_at: null },
      data: { type: TrichineType.CONFIRMATION },
    });

    const lnrEntity = await prisma.entity.findFirst({
      where: { type: EntityTypes.LABORATOIRE, is_lnr: true, deleted_at: null },
    });
    if (!lnrEntity) {
      capture(new Error('Trichine : aucun LNR seedé, FTP de confirmation non générée'), {
        extra: { pool_id: pool.id },
      });
    } else {
      const entityCode = await referenceCodeForEntity(ftp.destinataire_entity_id, userId);
      const lnrFtp = await withReferenceRetry(async () =>
        prisma.trichineFTP.create({
          data: {
            numero_fiche: await nextFTPReference(entityCode),
            expediteur_user_id: userId,
            expediteur_entity_id: ftp.destinataire_entity_id,
            destinataire_entity_id: lnrEntity.id,
            ftp_parent_id: ftp.id,
            statut_logistique: TrichineStatutLogistiqueFTP.ENVOYEE,
            date_envoi: body.date_envoi_lnr ?? new Date(),
            mode_transport: body.mode_transport_lnr?.trim() || null,
            conditions_conservation: body.conditions_conservation_lnr?.trim() || null,
            commentaire: `Confirmation LNR du pool ${pool.reference_pool} (résultat non négatif)`,
          },
        })
      );
      await prisma.trichinePoolFTP.create({ data: { pool_id: pool.id, ftp_id: lnrFtp.id } });
      ftpConfirmation = { id: lnrFtp.id, numero_fiche: lnrFtp.numero_fiche };
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
        title: `Pool non négatif à confirmer — FTP ${lnrFtp.numero_fiche}`,
        message: `Un laboratoire vous a transmis le pool ${pool.reference_pool} (résultat non négatif) pour confirmation via la FTP ${lnrFtp.numero_fiche}.`,
        email: {
          subject: `Pool non négatif à confirmer · FTP ${lnrFtp.numero_fiche}`,
          tone: 'warning',
          badge: 'Confirmation demandée',
          heading: 'Un pool non négatif vous est transmis pour confirmation',
          intro: `Un laboratoire agréé a obtenu un résultat non négatif sur le pool ${pool.reference_pool} et vous le transmet pour analyse de confirmation. La fiche de transmission est jointe à cet email.`,
          details: [
            { label: 'Pool', value: pool.reference_pool },
            { label: 'Fiche de transmission', value: lnrFtp.numero_fiche },
            ...detailsNombreLarves({ nombre_larves_lvd: nombreLarves }),
            ...(lnrFtp.mode_transport ? [{ label: 'Transport', value: lnrFtp.mode_transport }] : []),
            ...(lnrFtp.conditions_conservation
              ? [{ label: 'Conservation', value: lnrFtp.conditions_conservation }]
              : []),
          ],
          actions: [
            'Réceptionnez la fiche de transmission dans Zacharie à l’arrivée des échantillons.',
            'Saisissez le résultat de confirmation dès qu’il est disponible : l’émetteur en est averti automatiquement.',
          ],
        },
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
      title: `Résultat non négatif — pool ${pool.reference_pool}`,
      message: `Le laboratoire a détecté une larve dans le pool ${pool.reference_pool}. Une confirmation par le LNR est en cours. Vous pouvez réaliser des prélèvements de 2e intention pour identifier la carcasse incriminée.`,
      email: {
        subject: `Résultat non négatif · pool ${pool.reference_pool}`,
        tone: 'warning',
        badge: 'Résultat non négatif',
        heading: 'Une larve a été détectée, confirmation en cours',
        intro: `Le laboratoire a détecté une larve dans le pool ${pool.reference_pool}. Le pool a été transmis automatiquement au laboratoire national de référence (LNR) pour confirmer s’il s’agit bien de trichine.`,
        details: [
          { label: 'Pool', value: pool.reference_pool },
          { label: 'Fiche de transmission', value: ftp.numero_fiche },
        ],
        actions: [
          'Ne mettez pas sur le marché les carcasses de ce pool tant que le résultat définitif n’est pas connu.',
          'Pour identifier la carcasse concernée, vous pouvez réaliser des prélèvements de 2e intention sur les carcasses du pool.',
          'Si vous renoncez aux analyses de 2e intention, toutes les carcasses du pool seront retirées de leur fiche.',
        ],
      },
      notificationLogAction: `TRICHINE_RESULTAT_${pool.reference_pool}_DOUTEUX`,
    });
  }

  if (LNR_RESULTS.includes(body.resultat_analyse)) {
    const emetteursInitiaux = new Map<string, TrichineNotifiableUser>();
    if (ftp.ftp_parent_id) {
      const parentFtp = await prisma.trichineFTP.findUnique({ where: { id: ftp.ftp_parent_id } });
      if (parentFtp) {
        for (const user of await getFtpEmitterUsers(parentFtp)) emetteursInitiaux.set(user.id, user);
      }
    }

    const messages: Partial<Record<TrichineResultatAnalyse, string>> = {
      [TrichineResultatAnalyse.POSITIF]: `ALERTE SANITAIRE — Le LNR a confirmé la présence de trichine dans le pool ${pool.reference_pool}. Les carcasses concernées sont impropres à la consommation et doivent être retirées / saisies.`,
      [TrichineResultatAnalyse.NON_NEGATIF]: `Le LNR a identifié un parasite autre que la trichine (${body.parasite_identifie}) dans le pool ${pool.reference_pool}. Une décision est à prendre sur les carcasses concernées.`,
      [TrichineResultatAnalyse.PRESENCE_PARASITE_NON_IDENTIFIE]: `Le LNR a détecté un parasite non identifié dans le pool ${pool.reference_pool}. Une décision est à prendre sur les carcasses concernées.`,
    };
    const lnrDetails = [
      { label: 'Pool', value: pool.reference_pool },
      { label: 'Fiche de transmission', value: ftp.numero_fiche },
    ];
    const lnrDecisionActions = [
      'Ne mettez pas sur le marché les carcasses concernées avant d’avoir pris une décision.',
      'Rapprochez-vous des services vétérinaires de votre département pour statuer sur leur devenir.',
    ];
    const emails: Partial<Record<TrichineResultatAnalyse, TrichineEmailContent>> = {
      [TrichineResultatAnalyse.POSITIF]: {
        subject: `ALERTE SANITAIRE · trichine confirmée · pool ${pool.reference_pool}`,
        tone: 'danger',
        badge: 'Alerte sanitaire · Positif',
        heading: 'Présence de trichine confirmée',
        intro: `Le laboratoire national de référence (LNR) a confirmé la présence de trichine dans le pool ${pool.reference_pool}. Les carcasses concernées sont impropres à la consommation humaine.`,
        details: lnrDetails,
        actions: [
          'Ne commercialisez pas et ne consommez pas les carcasses concernées.',
          'Si des carcasses ou des morceaux ont déjà été cédés, prévenez immédiatement leurs détenteurs.',
          'Procédez à la saisie totale des carcasses concernées.',
          'Prenez contact avec les services vétérinaires (DDPP / DDETSPP) de votre département.',
        ],
      },
      [TrichineResultatAnalyse.NON_NEGATIF]: {
        subject: `Parasite identifié · pool ${pool.reference_pool}`,
        tone: 'danger',
        badge: 'Parasite autre que la trichine',
        heading: 'Un parasite autre que la trichine a été identifié',
        intro: `Le laboratoire national de référence (LNR) a identifié un parasite autre que la trichine dans le pool ${pool.reference_pool}. Une décision doit être prise sur les carcasses concernées.`,
        details: [
          ...lnrDetails,
          { label: 'Parasite identifié', value: body.parasite_identifie ?? 'Non précisé' },
        ],
        actions: lnrDecisionActions,
      },
      [TrichineResultatAnalyse.PRESENCE_PARASITE_NON_IDENTIFIE]: {
        subject: `Parasite non identifié · pool ${pool.reference_pool}`,
        tone: 'danger',
        badge: 'Parasite non identifié',
        heading: 'Un parasite non identifié a été détecté',
        intro: `Le laboratoire national de référence (LNR) a détecté un parasite qu’il n’a pas pu identifier dans le pool ${pool.reference_pool}. Une décision doit être prise sur les carcasses concernées.`,
        details: lnrDetails,
        actions: lnrDecisionActions,
      },
    };
    const notification = {
      type: TrichineNotificationType.RESULTAT_ANALYSE,
      objetType: TrichineObjetType.POOL,
      objetId: pool.id,
      title: `Résultat LNR — pool ${pool.reference_pool}`,
      message: messages[body.resultat_analyse]!,
      notificationLogAction: `TRICHINE_RESULTAT_${pool.reference_pool}_${body.resultat_analyse}`,
    };
    const email = emails[body.resultat_analyse]!;
    await notifyTrichineUsers({
      ...notification,
      users: emitterUsers,
      email: {
        ...email,
        details: [
          ...email.details,
          ...detailsNombreLarves({
            nombre_larves_lvd: pool.nombre_larves_lvd,
            nombre_larves_lnr: nombreLarves,
          }),
        ],
      },
      excludeUserIds: [userId],
    });
    await notifyTrichineUsers({
      ...notification,
      users: [...emetteursInitiaux.values()],
      email,
      excludeUserIds: [userId, ...emitterUsers.map((user) => user.id)],
    });
  }

  const updatedPool = await prisma.trichinePool.findUnique({
    where: { id: pool.id },
    omit: avecNombreLarves,
  });
  return { kind: 'ok', pool: updatedPool, ftpConfirmation, referenceIgnoree };
}

const EFFET_PAR_RESULTAT: Partial<Record<TrichineResultatAnalyse, PoolResultEffet>> = {
  [TrichineResultatAnalyse.NEGATIF]: 'liberees',
  [TrichineResultatAnalyse.DOUTEUX]: 'en_attente_confirmation',
  [TrichineResultatAnalyse.POSITIF]: 'a_saisir',
  [TrichineResultatAnalyse.NON_NEGATIF]: 'decision_a_prendre',
  [TrichineResultatAnalyse.PRESENCE_PARASITE_NON_IDENTIFIE]: 'decision_a_prendre',
};

export function describePoolResultActions({
  resultat_analyse,
  reference_pool,
  nbCarcasses,
  ftpNumero,
  referenceLabo,
}: {
  resultat_analyse: TrichineResultatAnalyse;
  reference_pool: string;
  nbCarcasses: number;
  ftpNumero: string;
  referenceLabo?: string;
}): { effet: PoolResultEffet; actions: Array<string> } {
  const carcasses = `${nbCarcasses} carcasse${nbCarcasses > 1 ? 's' : ''}`;
  const effet = EFFET_PAR_RESULTAT[resultat_analyse]!;
  const actions: Array<string> = [];
  if (effet === 'liberees') {
    actions.push(`Pool ${reference_pool} négatif : ${carcasses} libérée(s) côté trichine`);
    actions.push(`L'émetteur de la fiche ${ftpNumero} est prévenu par email`);
  }
  if (effet === 'en_attente_confirmation') {
    actions.push(
      `Pool ${reference_pool} non négatif : ${carcasses} bloquée(s) jusqu'à la confirmation du LNR`
    );
    actions.push(
      `Une fiche de transmission vers le LNR est créée et envoyée, à imprimer et joindre au colis`
    );
    actions.push(
      `L'émetteur de la fiche ${ftpNumero} est prévenu par email et peut faire des prélèvements de 2e intention`
    );
  }
  if (effet === 'a_saisir') {
    actions.push(`Pool ${reference_pool} positif : trichine confirmée, ${carcasses} à saisir`);
  }
  if (effet === 'decision_a_prendre') {
    actions.push(`Pool ${reference_pool} : parasite détecté, décision à prendre sur ${carcasses}`);
  }
  if (effet === 'a_saisir' || effet === 'decision_a_prendre') {
    actions.push(`Le laboratoire qui vous a transmis le pool et l'émetteur initial sont alertés par email`);
  }
  if (referenceLabo) {
    actions.push(`Votre référence interne « ${referenceLabo} » est enregistrée sur le pool`);
  }
  return { effet, actions };
}
