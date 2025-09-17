import express from 'express';
import passport from 'passport';
import { catchErrors } from '~/middlewares/errors.ts';
import type { FeiResponse, FeisResponse, FeisDoneResponse } from '~/types/responses';
const router: express.Router = express.Router();
import prisma from '~/prisma';
import {
  ApiKeyApprovalStatus,
  ApiKeyScope,
  EntityRelationType,
  EntityTypes,
  FeiOwnerRole,
  Prisma,
  UserRoles,
} from '@prisma/client';
import { RequestWithApiKeyLog } from '~/types/request';
import { carcasseForApiSelect } from '~/types/carcasse';
import { mapCarcasseForApi } from '~/utils/api';

export type CarcasseForResponseForApi = {
  ok: boolean;
  data: {
    carcasse: ReturnType<typeof mapCarcasseForApi> | null;
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
      const apiKey = await prisma.apiKey.findUnique({
        where: { id: apiKeyLog?.api_key_id },
      });
      const role: UserRoles = req.params.role_or_entity_type as UserRoles;
      const entityType: EntityTypes = req.params.role_or_entity_type as EntityTypes;
      if (!apiKey.active || (apiKey.expires_at && apiKey.expires_at < new Date())) {
        res.status(403).send({
          ok: false,
          data: { carcasse: null },
          error:
            "Votre clé n'est pas active. Si vous pensez que c'est une erreur, veuillez contacter le support via le formulaire de contact https://zacharie.beta.gouv.fr/contact.",
        });
        return;
      }
      if (
        !apiKey.scopes.includes(ApiKeyScope.CARCASSE_READ_FOR_USER) &&
        !apiKey.scopes.includes(ApiKeyScope.CARCASSE_READ_FOR_ENTITY)
      ) {
        res.status(403).send({
          ok: false,
          data: { carcasse: null },
          error:
            "Votre clé n'est pas autorisée à accéder aux carcasses. Si vous pensez que c'est une erreur, veuillez contacter le support via le formulaire de contact https://zacharie.beta.gouv.fr/contact.",
        });
        return;
      }
      const approvals = await prisma.apiKeyApprovalByUserOrEntity
        .findMany({
          where: {
            api_key_id: apiKeyLog?.api_key_id,
            status: ApiKeyApprovalStatus.APPROVED,
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
        data: { carcasse: mapCarcasseForApi(carcasse) },
        message:
          'Pour toute question ou remarque, veuillez contacter le support via le formulaire de contact https://zacharie.beta.gouv.fr/contact.',
      });
    },
  ),
);

export default router;
