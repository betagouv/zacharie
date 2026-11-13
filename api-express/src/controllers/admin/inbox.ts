import express from 'express';
import { catchErrors } from '~/middlewares/errors';
const router: express.Router = express.Router();
import prisma from '~/prisma';
import dayjs from 'dayjs';
import type { AdminInboxResponse } from '~/types/responses';
import { lockedEmailsSql } from '~/utils/login-lockout';

type ComptesBloques = NonNullable<AdminInboxResponse['data']>['comptes_bloques'];

router.get(
  '/inbox',
  catchErrors(
    async (req: express.Request, res: express.Response<AdminInboxResponse>, next: express.NextFunction) => {
      const ilYASeptJours = dayjs().subtract(7, 'day').toDate();

      const [enAttenteActivation, cfeiRows, onboardingIncomplet, comptesBloques, entitesNonPretes] =
        await Promise.all([
          prisma.user.count({
            where: { activated: false, onboarded_at: { not: null }, deleted_at: null },
          }),
          prisma.$queryRaw<Array<{ count: number }>>`
            SELECT COUNT(*)::int AS count
            FROM "User" u
            WHERE u.numero_cfei IS NOT NULL
              AND u.deleted_at IS NULL
              AND NOT EXISTS (
                SELECT 1 FROM "OfficialCfei" o WHERE UPPER(o.numero_cfei) = UPPER(u.numero_cfei)
              )
          `,
          prisma.user.count({
            where: { onboarded_at: null, created_at: { lt: ilYASeptJours }, deleted_at: null },
          }),
          prisma.$queryRaw<ComptesBloques>`
            SELECT u.id, u.prenom, u.nom_de_famille, u.email
            FROM "User" u
            JOIN (${lockedEmailsSql}
            ) bloques ON bloques.email = u.email
            WHERE u.deleted_at IS NULL
            ORDER BY u.nom_de_famille, u.prenom
          `,
          prisma.entity.count({
            where: { zacharie_compatible: false, deleted_at: null },
          }),
        ]);

      res.status(200).send({
        ok: true,
        data: {
          en_attente_activation: enAttenteActivation,
          cfei_introuvable: cfeiRows[0]?.count ?? 0,
          onboarding_incomplet: onboardingIncomplet,
          comptes_bloques: comptesBloques,
          entites_non_pretes: entitesNonPretes,
        },
        error: '',
      });
    }
  )
);

export default router;
