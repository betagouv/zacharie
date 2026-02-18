import {
  ApiKey,
  ApiKeyApprovalByUserOrEntity,
  ApiKeyApprovalStatus,
  ApiKeyLogAction,
  ApiKeyScope,
  Entity,
  User,
} from '@prisma/client';
import prisma from '~/prisma';
import { carcasseForApiSelect, CarcasseGetForApi } from '~/types/carcasse';
import { feiForApiSelect, FeiGetForApi } from '~/types/fei';
import { RequestWithApiKey } from '~/types/request';
import express from 'express';
import dayjs from 'dayjs';

export function mapCarcasseForApi(carcasse: CarcasseGetForApi, fei: FeiGetForApi) {
  if (!carcasse) {
    return null;
  }
  return {
    numero_bracelet: carcasse.numero_bracelet,
    fei_numero: carcasse.fei_numero,
    espece: carcasse.espece,
    type: carcasse.type,
    nombre_d_animaux: carcasse.nombre_d_animaux,
    heure_mise_a_mort: carcasse.heure_mise_a_mort,
    heure_evisceration: carcasse.heure_evisceration,
    examinateur_name:
      // @ts-ignore
      fei.FeiExaminateurInitialUser.prenom +
      ' ' +
      // @ts-ignore
      fei.FeiExaminateurInitialUser.nom_de_famille,
    examinateur_carcasse_sans_anomalie: carcasse.examinateur_carcasse_sans_anomalie,
    examinateur_anomalies_carcasse: carcasse.examinateur_anomalies_carcasse,
    examinateur_anomalies_abats: carcasse.examinateur_anomalies_abats,
    examinateur_commentaire: carcasse.examinateur_commentaire,
    examinateur_signed_at: carcasse.examinateur_signed_at,
    premier_detenteur_name:
      // @ts-ignore
      fei.FeiPremierDetenteurUser.prenom + ' ' + fei.FeiPremierDetenteurUser.nom_de_famille,
    premier_detenteur_depot_type: carcasse.premier_detenteur_depot_type,
    premier_detenteur_depot_ccg_at: carcasse.premier_detenteur_depot_ccg_at,
    premier_detenteur_transport_type: carcasse.premier_detenteur_transport_type,
    premier_detenteur_transport_date: carcasse.premier_detenteur_transport_date,
    premier_detenteur_prochain_detenteur_role_cache: carcasse.premier_detenteur_prochain_detenteur_role_cache,
    // premier_detenteur_prochain_detenteur_name: fei.pro
    // latest_intermediaire_name
    // latest_intermediaire_poids_carcasse
    latest_intermediaire_carcasse_refus_motif: carcasse.intermediaire_carcasse_refus_motif,
    latest_intermediaire_carcasse_manquante: carcasse.intermediaire_carcasse_manquante,
    latest_intermediaire_decision_at: carcasse.latest_intermediaire_signed_at,
    latest_intermediaire_prise_en_charge_at: carcasse.latest_intermediaire_signed_at,
    svi_assigned_to_fei_at: carcasse.svi_assigned_to_fei_at,
    carcasse_status: carcasse.svi_carcasse_status,
    carcasse_status_set_at: carcasse.svi_carcasse_status_set_at,
    svi_ipm1_date: carcasse.svi_ipm1_date,
    svi_ipm1_presentee_inspection: carcasse.svi_ipm1_presentee_inspection,
    svi_ipm1_protocole: carcasse.svi_ipm1_protocole,
    svi_ipm1_pieces: carcasse.svi_ipm1_pieces,
    svi_ipm1_lesions_ou_motifs: carcasse.svi_ipm1_lesions_ou_motifs,
    svi_ipm1_nombre_animaux: carcasse.svi_ipm1_nombre_animaux,
    svi_ipm1_commentaire: carcasse.svi_ipm1_commentaire,
    svi_ipm1_decision: carcasse.svi_ipm1_decision,
    svi_ipm1_duree_consigne: carcasse.svi_ipm1_duree_consigne,
    svi_ipm1_poids_consigne: carcasse.svi_ipm1_poids_consigne,
    svi_ipm1_poids_type: carcasse.svi_ipm1_poids_type,
    svi_ipm1_signed_at: carcasse.svi_ipm1_signed_at,
    svi_ipm2_date: carcasse.svi_ipm2_date,
    svi_ipm2_presentee_inspection: carcasse.svi_ipm2_presentee_inspection,
    svi_ipm2_protocole: carcasse.svi_ipm2_protocole,
    svi_ipm2_pieces: carcasse.svi_ipm2_pieces,
    svi_ipm2_lesions_ou_motifs: carcasse.svi_ipm2_lesions_ou_motifs,
    svi_ipm2_nombre_animaux: carcasse.svi_ipm2_nombre_animaux,
    svi_ipm2_commentaire: carcasse.svi_ipm2_commentaire,
    svi_ipm2_decision: carcasse.svi_ipm2_decision,
    svi_ipm2_traitement_assainissant: carcasse.svi_ipm2_traitement_assainissant,
    svi_ipm2_traitement_assainissant_cuisson_temps: carcasse.svi_ipm2_traitement_assainissant_cuisson_temps,
    svi_ipm2_traitement_assainissant_cuisson_temp: carcasse.svi_ipm2_traitement_assainissant_cuisson_temp,
    svi_ipm2_traitement_assainissant_congelation_temps:
      carcasse.svi_ipm2_traitement_assainissant_congelation_temps,
    svi_ipm2_traitement_assainissant_congelation_temp:
      carcasse.svi_ipm2_traitement_assainissant_congelation_temp,
    svi_ipm2_traitement_assainissant_type: carcasse.svi_ipm2_traitement_assainissant_type,
    svi_ipm2_traitement_assainissant_paramètres: carcasse.svi_ipm2_traitement_assainissant_paramètres,
    svi_ipm2_traitement_assainissant_etablissement: carcasse.svi_ipm2_traitement_assainissant_etablissement,
    svi_ipm2_traitement_assainissant_poids: carcasse.svi_ipm2_traitement_assainissant_poids,
    svi_ipm2_poids_saisie: carcasse.svi_ipm2_poids_saisie,
    svi_ipm2_poids_type: carcasse.svi_ipm2_poids_type,
    svi_ipm2_signed_at: carcasse.svi_ipm2_signed_at,
    created_at: carcasse.created_at,
    updated_at: carcasse.updated_at,
    fei_date_mise_a_mort: dayjs(fei.date_mise_a_mort).format('YYYY-MM-DD'),
    fei_commune_mise_a_mort: fei.commune_mise_a_mort,
    fei_heure_mise_a_mort_premiere_carcasse: fei.heure_mise_a_mort_premiere_carcasse,
    fei_heure_evisceration_derniere_carcasse: fei.heure_evisceration_derniere_carcasse,
    fei_examinateur_initial_approbation_mise_sur_le_marche:
      fei.examinateur_initial_approbation_mise_sur_le_marche,
    fei_examinateur_initial_date_approbation_mise_sur_le_marche:
      fei.examinateur_initial_date_approbation_mise_sur_le_marche,
    fei_automatic_closed_at: fei.automatic_closed_at,
    fei_intermediaire_closed_at: fei.intermediaire_closed_at,
    fei_svi_assigned_at: fei.svi_assigned_at,
    fei_svi_closed_at: fei.svi_closed_at,
  };
}

export function mapFeiForApi(fei: FeiGetForApi, carcasses: CarcasseGetForApi[]) {
  if (!fei) {
    return null;
  }
  let intermediaireClosedByName = '';
  let latestIntermediaireByName = '';
  let premierDetenteurProchainDetenteurName = '';
  let premierDetenteurProchainDetenteurRole = '';
  const carcasseIntermediaires: Array<Entity> = [];
  const carcasseIntermediaireIds = new Set();
  for (const carcasseIntermediaire of fei?.CarcasseIntermediaire || []) {
    // sorted by created_at desc, so in order
    if (carcasseIntermediaire.intermediaire_id) {
      // @ts-ignore
      const entity = carcasseIntermediaire.CarcasseIntermediaireEntity as Entity;
      if (!carcasseIntermediaireIds.has(carcasseIntermediaire.intermediaire_id)) {
        carcasseIntermediaires.push(entity);
        carcasseIntermediaireIds.add(carcasseIntermediaire.intermediaire_id);
      }
    }
  }
  if (fei.intermediaire_closed_at) {
    intermediaireClosedByName = carcasseIntermediaires.find(
      (entity) => entity.id === fei.intermediaire_closed_by_entity_id,
    )?.raison_sociale;
  }
  if (fei.CarcasseIntermediaire.length > 0) {
    latestIntermediaireByName = carcasseIntermediaires[0]?.raison_sociale;
    premierDetenteurProchainDetenteurName = carcasseIntermediaires.at(-1)?.raison_sociale;
    premierDetenteurProchainDetenteurRole = carcasseIntermediaires.at(-1)?.type;
  }
  return {
    numero: fei.numero,
    date_mise_a_mort: dayjs(fei.date_mise_a_mort).format('YYYY-MM-DD'),
    commune_mise_a_mort: fei.commune_mise_a_mort,
    heure_mise_a_mort_premiere_carcasse: fei.heure_mise_a_mort_premiere_carcasse,
    heure_evisceration_derniere_carcasse: fei.heure_evisceration_derniere_carcasse,
    examinateur_initial_name:
      fei.FeiExaminateurInitialUser?.prenom + ' ' + fei.FeiExaminateurInitialUser?.nom_de_famille,
    examinateur_initial_approbation_mise_sur_le_marche:
      fei.examinateur_initial_approbation_mise_sur_le_marche,
    examinateur_initial_date_approbation_mise_sur_le_marche:
      fei.examinateur_initial_date_approbation_mise_sur_le_marche,
    premier_detenteur_name: fei.FeiPremierDetenteurEntity
      ? fei.FeiPremierDetenteurEntity?.raison_sociale
      : fei.FeiPremierDetenteurUser?.prenom + ' ' + fei.FeiPremierDetenteurUser?.nom_de_famille,
    premier_detenteur_depot_type: fei.premier_detenteur_depot_type,
    premier_detenteur_depot_name: fei.FeiPremierDetenteurEntity?.raison_sociale,
    premier_detenteur_depot_ccg_at: fei.premier_detenteur_depot_ccg_at,
    premier_detenteur_transport_type: fei.premier_detenteur_transport_type,
    premier_detenteur_transport_date: fei.premier_detenteur_transport_date,
    premier_detenteur_prochain_detenteur_name: premierDetenteurProchainDetenteurName,
    premier_detenteur_prochain_detenteur_role: premierDetenteurProchainDetenteurRole,
    intermediaire_closed_at: fei.intermediaire_closed_at,
    intermediaire_closed_by_name: intermediaireClosedByName,
    latest_intermediaire_name: latestIntermediaireByName,
    svi_assigned_at: fei.svi_assigned_at,
    svi_entity_name: fei.FeiSviEntity?.raison_sociale,
    svi_closed_at: fei.svi_closed_at,
    automatic_closed_at: fei.automatic_closed_at,
    created_at: fei.created_at,
    updated_at: fei.updated_at,
    deleted_at: fei.deleted_at,
    carcasses: carcasses.map((carcasse) => mapCarcasseForApi(carcasse, fei)),
  };
}

export async function getDedicatedEntityLinkedToApiKey(apiKey: ApiKey): Promise<Entity | null> {
  const approvals = await prisma.apiKeyApprovalByUserOrEntity.findMany({
    where: {
      api_key_id: apiKey.id,
      status: ApiKeyApprovalStatus.APPROVED,
    },
    include: {
      User: true,
      Entity: true,
    },
  });

  if (!approvals.length) return null;
  if (approvals.length > 1) return null;
  if (!approvals[0].Entity) return null;

  const entity = approvals[0].Entity!;
  if (apiKey.dedicated_to_entity_id !== entity.id) {
    return null;
  }

  return entity;
}

export async function getRequestedUser(
  apiKey: ApiKey,
  email: string,
): Promise<{ error?: string; user?: User }> {
  if (!email) {
    return {
      error: `Il manque l'email dans la requête. Si vous pensez que c'est une erreur, veuillez contacter le support via le formulaire de contact https://zacharie.beta.gouv.fr/contact.`,
    };
  }

  const user = await prisma.user.findUnique({
    where: {
      email: email,
    },
  });

  if (!user) {
    return {
      error: `Votre clé n'est pas autorisée à accéder à des données de cet utilisateur par cette requête. Si vous pensez que c'est une erreur, veuillez contacter le support via le formulaire de contact https://zacharie.beta.gouv.fr/contact.`,
    };
  }

  const approval = await prisma.apiKeyApprovalByUserOrEntity.findFirst({
    where: {
      api_key_id: apiKey?.id,
      user_id: user.id,
    },
  });

  if (!approval) {
    return {
      error: `Vous n'avez pas fait de demande d'accès pour cet email. Faites un appel POST /approval-request/user avec l'email de l'utilisateur auparavant. Si vous pensez que c'est une erreur, veuillez contacter le support via le formulaire de contact https://zacharie.beta.gouv.fr/contact.`,
    };
  }

  if (approval.status === ApiKeyApprovalStatus.PENDING) {
    return {
      error: `Votre demande d'accès n'a pas encore été approuvée. L'utilisateur doit désormais se rendre sur https://zacharie.beta.gouv.fr/app/tableau-de-bord/mon-profil/partage-de-mes-donnees pour approuver ou rejeter la demande. Il se connecte puis clique sur 'Mon profil' puis 'Partage de mes données'. Si vous pensez que c'est une erreur, veuillez contacter le support via le formulaire de contact https://zacharie.beta.gouv.fr/contact.`,
    };
  }

  if (approval.status === ApiKeyApprovalStatus.REJECTED) {
    return {
      error: `Votre demande d'accès a été rejetée par l'utilisateur. Si vous pensez que c'est une erreur, veuillez contacter le support via le formulaire de contact https://zacharie.beta.gouv.fr/contact.`,
    };
  }

  if (approval.status !== ApiKeyApprovalStatus.APPROVED) {
    return {
      error: `Votre demande d'accès n'a pas été approuvée. Si vous pensez que c'est une erreur, veuillez contacter le support via le formulaire de contact https://zacharie.beta.gouv.fr/contact.`,
    };
  }

  return {
    user: user,
  };
}

export const checkApiKeyIsValidMiddleware =
  (scopes: Array<ApiKeyScope>) =>
  async (req: RequestWithApiKey, res: express.Response, next: express.NextFunction) => {
    const apiKey = req.apiKey;
    if (!apiKey.active || (apiKey.expires_at && apiKey.expires_at < new Date())) {
      const error = new Error(
        "Votre clé n'est pas active. Si vous pensez que c'est une erreur, veuillez contacter le support via le formulaire de contact https://zacharie.beta.gouv.fr/contact.",
      );
      res.status(401);
      return next(error);
    }
    if (!scopes.some((scope) => apiKey.scopes.includes(scope))) {
      const error = new Error(
        "Votre clé n'est pas autorisée à accéder à cette ressource. Si vous pensez que c'est une erreur, veuillez contacter le support via le formulaire de contact https://zacharie.beta.gouv.fr/contact.",
      );
      res.status(401);
      return next(error);
    }
    next();
  };

export type WebhookEvent =
  | 'USER_APPROVED_ACCESS'
  | 'USER_REJECTED_ACCESS'
  | 'FEI_APPROBATION_MISE_SUR_LE_MARCHE'
  | 'FEI_ASSIGNEE_AU_PROCHAIN_DETENTEUR'
  | 'FEI_ASSIGNEE_AU_SVI'
  | 'FEI_PRISE_EN_CHARGE_PAR_PROCHAIN_DETENTEUR'
  | 'FEI_CLOTUREE';

export async function sendWebhook(
  userId: string,
  event: WebhookEvent,
  {
    feiNumero = undefined,
    carcasseZacharieId = undefined,
    userApprovals = undefined,
  }: {
    feiNumero?: string;
    carcasseZacharieId?: string;
    userApprovals?: Array<ApiKeyApprovalByUserOrEntity & { ApiKey: ApiKey }>;
  },
) {
  if (!userApprovals) {
    userApprovals = await prisma.apiKeyApprovalByUserOrEntity.findMany({
      where: {
        user_id: userId,
      },
      include: {
        ApiKey: true,
      },
    });
  }
  for (const userApproval of userApprovals) {
    if (userApproval.status !== ApiKeyApprovalStatus.APPROVED) continue;
    const apiKey = userApproval.ApiKey;
    if (!apiKey.webhook_url) continue;
    if (!apiKey.webhook_url.startsWith('https://')) continue;
    let fei: FeiGetForApi | null = null;
    let carcasses: CarcasseGetForApi[] = [];
    if (feiNumero) {
      fei = await prisma.fei.findUnique({
        where: {
          numero: feiNumero,
          deleted_at: null,
        },
        select: feiForApiSelect,
      });

      carcasses = await prisma.carcasse.findMany({
        where: {
          fei_numero: feiNumero,
          deleted_at: null,
        },
        select: carcasseForApiSelect,
      });
    }
    if (carcasseZacharieId) {
      const carcasse = await prisma.carcasse.findUnique({
        where: {
          zacharie_carcasse_id: carcasseZacharieId,
          deleted_at: null,
        },
        select: carcasseForApiSelect,
      });
      if (carcasse) {
        carcasses.push(carcasse);
      }
    }
    const payload = { event, fei, carcasses };
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    fetch(apiKey.webhook_url, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey.private_key}`,
      },
      signal: controller.signal,
    })
      .then((res) => {
        clearTimeout(timeoutId); // Clear timeout on success
        prisma.apiKeyLog.create({
          data: {
            api_key_id: apiKey.id,
            action: ApiKeyLogAction.WEBHOOK_SENT,
            endpoint: `POST ${apiKey.webhook_url} ${event} ${feiNumero} ${carcasseZacharieId} ${res.status}`,
          },
        });
      })
      .catch((err) => {
        clearTimeout(timeoutId); // Clear timeout on error
        console.error(`Failed to send webhook for event ${event} to ${apiKey.webhook_url}`, err);
      });
  }
}
