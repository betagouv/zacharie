import express from 'express';
import passport from 'passport';
import { catchErrors } from '~/middlewares/errors';
import prisma from '~/prisma';
import { CarcasseModificationRequestStatus, UserRoles } from '@prisma/client';

const router: express.Router = express.Router();

// Création / approbation / refus passent par le pipeline /sync (pattern local-first).
// Cet endpoint ne sert qu'à hydrater le dashboard de l'examinateur (demandes en attente
// portant sur des fiches dont il est l'examinateur initial).

router.get(
  '/for-examinateur',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: express.Request, res: express.Response) => {
    if (!req.user.activated) {
      res.status(400).send({ ok: false, data: null, error: "Le compte n'est pas activé" });
      return;
    }
    if (!req.user.roles.includes(UserRoles.CHASSEUR)) {
      res.status(403).send({ ok: false, data: null, error: 'Unauthorized' });
      return;
    }

    const requests = await prisma.carcasseModificationRequest.findMany({
      where: {
        status: CarcasseModificationRequestStatus.PENDING,
        deleted_at: null,
        Carcasse: {
          examinateur_initial_user_id: req.user.id,
          deleted_at: null,
        },
      },
      include: {
        Carcasse: true,
        RequestedByUser: true,
        RequestedByEntity: true,
        ReviewedByUser: true,
      },
      orderBy: { requested_at: 'desc' },
    });

    res.status(200).send({ ok: true, data: { requests }, error: '' });
  })
);

export default router;
