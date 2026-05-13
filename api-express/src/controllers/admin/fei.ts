import express from 'express';
import { catchErrors } from '~/middlewares/errors';
const router: express.Router = express.Router();
import prisma from '~/prisma';

router.get(
  '/feis',
  catchErrors(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Fetch the fiche data along with the required intervenants
    const feis = await prisma.fei.findMany({
      where: { deleted_at: null },
      include: {
        FeiCurrentUser: { select: { email: true } }, // Fetching the current user's email
        FeiCurrentEntity: { select: { nom_d_usage: true } }, // Fetching the current entity's raison sociale
        FeiNextEntity: { select: { nom_d_usage: true } }, // Fetching the next entity's raison sociale
        FeiNextUser: { select: { email: true } }, // Fetching the next user's email
        FeiExaminateurInitialUser: { select: { email: true } }, // Fetching the examinateur's email
        FeiPremierDetenteurUser: { select: { email: true } }, // Fetching the premier detenteur's email
        FeiPremierDetenteurEntity: { select: { nom_d_usage: true } }, // Fetching the premier detenteur's raison sociale
        CarcasseIntermediaire: {
          include: {
            CarcasseIntermediaireEntity: {
              select: {
                nom_d_usage: true,
                type: true,
              },
            },
          },
        },
        FeiSviEntity: { select: { nom_d_usage: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    res.status(200).send({
      ok: true,
      data: {
        feis: feis.map((fei) => ({
          ...fei,
          responsabilites: [
            {
              type: 'Propriétaire actuel',
              role: fei.fei_current_owner_role,
              email: fei.FeiCurrentUser?.email,
              nom_d_usage: fei.FeiCurrentEntity?.nom_d_usage,
            },
            {
              type: 'Propriétaire suivant',
              role: fei.fei_next_owner_role,
              email: fei.FeiNextUser?.email,
              nom_d_usage: fei.FeiNextEntity?.nom_d_usage,
            },
          ],
          intervenants: [
            {
              type: 'Examinateur Initial',
              email: fei.FeiExaminateurInitialUser?.email,
              nom_d_usage: '',
            },
            {
              type: 'Premier Detenteur',
              email: fei.FeiPremierDetenteurUser?.email,
              nom_d_usage: '',
            },
            ...Object.values(
              fei.CarcasseIntermediaire.reduce(
                (acc, intermediaire) => {
                  if (acc[intermediaire.intermediaire_entity_id]) return acc;
                  return {
                    ...acc,
                    [intermediaire.intermediaire_entity_id]: {
                      type: intermediaire.intermediaire_role,
                      email: '',
                      nom_d_usage: intermediaire.CarcasseIntermediaireEntity.nom_d_usage,
                    },
                  };
                },
                {} as Record<string, { type: string; email: string; nom_d_usage: string }>
              )
            ),
            {
              type: 'SVI',
              email: '',
              nom_d_usage: fei.FeiSviEntity?.nom_d_usage,
            },
          ],
        })),
      },
      error: '',
    });
  })
);

export default router;
