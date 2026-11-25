import express from 'express';
import { catchErrors } from '~/middlewares/errors';
const router: express.Router = express.Router();
import prisma from '~/prisma';
import dayjs from 'dayjs';
import type { AdminInboxResponse } from '~/types/responses';
import { LOCKOUT_DURATION_MINUTES, LOGIN_LOCKED_ACTION } from '~/utils/login-lockout';

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
                SELECT 1 FROM "OfficialCfei" o WHERE o.numero_cfei = u.numero_cfei
              )
          `,
          prisma.user.count({
            where: { onboarded_at: null, created_at: { lt: ilYASeptJours }, deleted_at: null },
          }),
          // même règle que getLockoutState : un blocage (LOGIN_LOCKED) de la fenêtre, sans déblocage admin après lui.
          // created_at est un timestamp sans fuseau stocké en UTC : la borne est calculée en UTC côté base,
          // quel que soit le TimeZone de la session. Elle est écrite en ligne (pas de CTE) pour que le
          // planificateur estime le nombre de lignes de la fenêtre et passe par l'index created_at
          prisma.$queryRaw<ComptesBloques>`
            SELECT u.id, u.prenom, u.nom_de_famille, u.email
            FROM "User" u
            JOIN (
              SELECT DISTINCT l.email
              FROM "SecurityLog" l
              WHERE l.action = ${LOGIN_LOCKED_ACTION}
                AND l.created_at >= (now() AT TIME ZONE 'UTC') - make_interval(mins => ${LOCKOUT_DURATION_MINUTES}::int)
                AND NOT EXISTS (
                  SELECT 1
                  FROM "SecurityLog" d
                  WHERE d.email = l.email
                    AND d.action = 'LOGIN_UNLOCK_FROM_ADMIN'
                    AND d.created_at > l.created_at
                )
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
