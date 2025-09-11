import express from 'express';
import passport from 'passport';
import { catchErrors } from '~/middlewares/errors.ts';
import type { FeiResponse, FeisResponse, FeisDoneResponse } from '~/types/responses';
const router: express.Router = express.Router();
import prisma from '~/prisma';
import {
  ApiKeyApprovalStatus,
  EntityRelationType,
  EntityTypes,
  FeiOwnerRole,
  Prisma,
  UserRoles,
} from '@prisma/client';
import { RequestWithApiKeyLog } from '~/types/request';

export const carcasseForApiSelect = {
  // zacharie_carcasse_id: false,
  numero_bracelet: true,
  fei_numero: true,
  espece: true,
  type: true,
  nombre_d_animaux: true,
  heure_mise_a_mort: true,
  heure_evisceration: true,
  /**
   * EXAMINATEUR
   */
  examinateur_carcasse_sans_anomalie: true,
  examinateur_anomalies_carcasse: true,
  examinateur_anomalies_abats: true,
  examinateur_commentaire: true,
  examinateur_signed_at: true,
  /**
   * PREMIER DETENTEUR
   * duplicatas des champs de Fei
   * anticipation des circuits courts où on pourra envoyer des carcasses éparpillées, d'un même examen initial,
   */
  premier_detenteur_depot_type: true, // CCG, ETG, AUCUN
  // premier_detenteur_depot_entity_id: false,
  premier_detenteur_depot_ccg_at: true,
  premier_detenteur_transport_type: true,
  premier_detenteur_transport_date: true,
  premier_detenteur_prochain_detenteur_role_cache: true,
  // premier_detenteur_prochain_detenteur_id_cache: false,
  /**
   * INTERMEDIAIRE
   */
  // intermediaire_carcasse_refus_intermediaire_id: false,
  intermediaire_carcasse_refus_motif: true,
  intermediaire_carcasse_manquante: true,
  latest_intermediaire_signed_at: true,
  /**
   * SVI
   */
  svi_assigned_to_fei_at: true, // same as svi_assigned_at in fei
  svi_carcasse_commentaire: true, // cache of ipm1 and ipm2 comments
  svi_carcasse_status: true,
  svi_carcasse_status_set_at: true,
  /**
   * SVI IPM1
   */
  svi_ipm1_date: true,
  svi_ipm1_presentee_inspection: true,
  // svi_ipm1_user_id: false,
  // svi_ipm1_user_name_cache: false,
  svi_ipm1_protocole: true,
  svi_ipm1_pieces: true,
  svi_ipm1_lesions_ou_motifs: true,
  svi_ipm1_nombre_animaux: true,
  svi_ipm1_commentaire: true,
  svi_ipm1_decision: true,
  svi_ipm1_duree_consigne: true,
  svi_ipm1_poids_consigne: true,
  svi_ipm1_poids_type: true,
  svi_ipm1_signed_at: true,
  /**
   * SVI IPM2
   */
  svi_ipm2_date: true,
  svi_ipm2_presentee_inspection: true,
  // svi_ipm2_user_id: false,
  // svi_ipm2_user_name_cache: false,
  svi_ipm2_protocole: true,
  svi_ipm2_pieces: true,
  svi_ipm2_lesions_ou_motifs: true,
  svi_ipm2_nombre_animaux: true,
  svi_ipm2_commentaire: true,
  svi_ipm2_decision: true,
  svi_ipm2_traitement_assainissant: true,
  svi_ipm2_traitement_assainissant_cuisson_temps: true,
  svi_ipm2_traitement_assainissant_cuisson_temp: true,
  svi_ipm2_traitement_assainissant_congelation_temps: true,
  svi_ipm2_traitement_assainissant_congelation_temp: true,
  svi_ipm2_traitement_assainissant_type: true,
  svi_ipm2_traitement_assainissant_paramètres: true,
  svi_ipm2_traitement_assainissant_etablissement: true,
  svi_ipm2_traitement_assainissant_poids: true,
  svi_ipm2_poids_saisie: true,
  svi_ipm2_poids_type: true,
  svi_ipm2_signed_at: true,
  created_at: true,
  updated_at: true,
  // CarcasseCertificats: false,
  // SviIpm1User: false,
  // CarcasseIntermediaire: false,
  Fei: {
    select: {
      // id: false,
      numero: true,
      date_mise_a_mort: true,
      commune_mise_a_mort: true,
      heure_mise_a_mort_premiere_carcasse: true,
      heure_evisceration_derniere_carcasse: true,
      resume_nombre_de_carcasses: true,
      examinateur_initial_approbation_mise_sur_le_marche: true,
      examinateur_initial_date_approbation_mise_sur_le_marche: true,
      automatic_closed_at: true,
      intermediaire_closed_at: true, // si toutes les carcasses sont rejetées/manquantes
      svi_assigned_at: true,
      svi_closed_at: true,
    },
  },
} as const;

export type CarcasseGetForApi = Prisma.CarcasseGetPayload<{
  select: typeof carcasseForApiSelect;
}>;

export type CarcasseForResponseForApi = {
  ok: boolean;
  data: {
    carcasse: CarcasseGetForApi | null;
  };
  error?: string;
  message?: string;
};

router.get(
  '/:role_or_entity_type/:date_mise_a_mort/:numero_bracelet',
  passport.authenticate('apiKeyLog', { session: false }),
  catchErrors(
    async (
      req: RequestWithApiKeyLog,
      res: express.Response<CarcasseForResponseForApi>,
      next: express.NextFunction,
    ) => {
      const apiKeyLog = req.apiKeyLog;
      const role: UserRoles = req.params.role_or_entity_type as UserRoles;
      const entityType: EntityTypes = req.params.role_or_entity_type as EntityTypes;
      const approvals = await prisma.apiKeyApprovalByUserOrEntity
        .findMany({
          where: {
            api_key_id: apiKeyLog?.api_key_id,
            status: ApiKeyApprovalStatus.APPROVED,
            ApiKey: {
              active: true,
              expires_at: {
                gt: new Date(),
              },
            },
          },
          include: {
            User: true,
            Entity: true,
          },
        })
        .then((approvals) => {
          return approvals.filter((apiKeyApproval) => {
            if (apiKeyApproval.User.roles.includes(role)) return true;
            if (apiKeyApproval.Entity.type === entityType) return true;
            return false;
          });
        });
      if (!approvals.length) {
        res.status(403).send({
          ok: false,
          data: { carcasse: null },
          error: `Votre clé n'est pas autorisée à accéder aux carcasses pour un role ${req.params.role_or_entity_type}. Si vous pensez que c'est une erreur, veuillez contacter le support via le formulaire de contact https://zacharie.beta.gouv.fr/contact.`,
        });
        return;
      }
      const carcasse = await prisma.carcasse.findFirst({
        where: {
          numero_bracelet: req.params.numero_bracelet,
          date_mise_a_mort: req.params.date_mise_a_mort,
          deleted_at: null,
        },
        select: carcasseForApiSelect,
      });

      if (!carcasse) {
        res.status(404).send({
          ok: false,
          data: { carcasse: null },
          error: 'Carcasse non trouvée',
        });
        return;
      }

      const fei = await prisma.fei.findUnique({
        where: {
          numero: carcasse.fei_numero,
        },
        include: {
          CarcasseIntermediaire: true,
        },
      });

      let canAccess = false;
      let requestId: string | null = null;
      switch (role) {
        case UserRoles.CHASSEUR:
          requestId = fei.examinateur_initial_user_id;
          if (requestId && approvals.find((a) => a.User.id === requestId)) {
            canAccess = true;
            break;
          }
          requestId = fei.premier_detenteur_user_id;
          if (requestId && approvals.find((a) => a.User.id === requestId)) {
            canAccess = true;
            break;
          }
          requestId = fei.premier_detenteur_entity_id;
          if (requestId && approvals.find((a) => a.Entity.id === requestId)) {
            canAccess = true;
            break;
          }
          break;
        default:
          break;
      }
      switch (entityType) {
        case EntityTypes.ETG:
          const carcasseIntermediaires = fei.CarcasseIntermediaire.filter(
            (c) => c.numero_bracelet === carcasse.numero_bracelet,
          );
          const intermediaires = carcasseIntermediaires.filter(
            (c) => c.intermediaire_role === FeiOwnerRole.ETG,
          );
          if (!intermediaires.length) {
            break;
          }
          for (const intermediaire of intermediaires) {
            requestId = intermediaire.intermediaire_entity_id;
            if (requestId && approvals.find((a) => a.Entity.id === requestId)) {
              canAccess = true;
              break;
            }
          }
          break;
        case EntityTypes.SVI:
          // TODO
          break;
        default:
          break;
      }

      if (!canAccess) {
        res.status(403).send({
          ok: false,
          data: { carcasse: null },
          error:
            "Vous n'avez pas les permissions pour accéder à cette carcasse. Si vous pensez que c'est une erreur, veuillez contacter le support via le formulaire de contact https://zacharie.beta.gouv.fr/contact.",
        });
        return;
      }
      res.status(200).send({
        ok: true,
        data: { carcasse },
        message:
          'Pour toute question ou remarque, veuillez contacter le support via le formulaire de contact https://zacharie.beta.gouv.fr/contact.',
      });
    },
  ),
);

export default router;
