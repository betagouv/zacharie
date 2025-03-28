import express from 'express';
import passport from 'passport';
import { catchErrors } from '../middlewares/errors';
import type { CarcasseIntermediaireResponse } from '~/types/responses';
const router: express.Router = express.Router();
import prisma from '~/prisma';
import { Prisma } from '@prisma/client';
import { getCarcasseIntermediaireId } from '~/utils/get-carcasse-intermediaire-id';
import dayjs from 'dayjs';
import { capture } from '~/third-parties/sentry';

router.post(
  '/:fei_numero/:intermediaire_id/:numero_bracelet',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    // Fetch the fiche data along with the required intervenants
    const body = req.body;
    const user = req.user;
    const { fei_numero, intermediaire_id, numero_bracelet } = req.params;
    if (!fei_numero) {
      res.status(400).send({
        ok: false,
        data: { carcasseIntermediaire: null },
        error: 'Le numéro de fiche est obligatoire',
      } satisfies CarcasseIntermediaireResponse);
      return;
    }
    const existingFei = await prisma.fei.findUnique({
      where: { numero: fei_numero },
    });
    if (!existingFei) {
      res.status(400).send({
        ok: false,
        data: { carcasseIntermediaire: null },
        error: 'Fiche non trouvée',
      } satisfies CarcasseIntermediaireResponse);
      return;
    }
    if (!numero_bracelet) {
      res.status(400).send({
        ok: false,
        data: { carcasseIntermediaire: null },
        error: 'Le numéro de la carcasse est obligatoire',
      } satisfies CarcasseIntermediaireResponse);
      return;
    }
    const existingCarcasse = await prisma.carcasse.findFirst({
      where: {
        numero_bracelet: numero_bracelet,
        fei_numero: fei_numero,
      },
    });
    if (!existingCarcasse) {
      res.status(400).send({
        ok: false,
        data: { carcasseIntermediaire: null },
        error: 'Carcasse not found',
      } satisfies CarcasseIntermediaireResponse);
      return;
    }
    if (!intermediaire_id) {
      res.status(400).send({
        ok: false,
        data: { carcasseIntermediaire: null },
        error: "L'identifiant du destinataire est obligatoire",
      } satisfies CarcasseIntermediaireResponse);
      return;
    }
    const feiIntermediaire = await prisma.feiIntermediaire.findUnique({
      where: { id: intermediaire_id },
    });
    if (!feiIntermediaire) {
      capture(new Error('Intermediaire not found yet on fei carcasse intermediaire creation'), {
        extra: {
          fei_numero,
          intermediaire_id,
          numero_bracelet,
        },
      });
      res.status(400).send({
        ok: false,
        data: { carcasseIntermediaire: null },
        error: 'Intermediaire not found',
      } satisfies CarcasseIntermediaireResponse);
      return;
    }

    const fei_numero__bracelet__intermediaire_id = getCarcasseIntermediaireId(
      fei_numero,
      numero_bracelet,
      intermediaire_id,
    );

    const data: Prisma.CarcasseIntermediaireUncheckedCreateInput = {
      fei_numero__bracelet__intermediaire_id,
      fei_numero: fei_numero,
      numero_bracelet,
      zacharie_carcasse_id: existingCarcasse.zacharie_carcasse_id,
      fei_intermediaire_id: intermediaire_id,
      fei_intermediaire_user_id: user.id,
      fei_intermediaire_entity_id: feiIntermediaire.fei_intermediaire_entity_id,
      is_synced: true,
    };

    if (body.hasOwnProperty(Prisma.CarcasseIntermediaireScalarFieldEnum.commentaire)) {
      data.commentaire = body[Prisma.CarcasseIntermediaireScalarFieldEnum.commentaire];
    }
    if (body.hasOwnProperty(Prisma.CarcasseIntermediaireScalarFieldEnum.prise_en_charge)) {
      data.prise_en_charge = body[Prisma.CarcasseIntermediaireScalarFieldEnum.prise_en_charge];
    }
    if (body.hasOwnProperty(Prisma.CarcasseIntermediaireScalarFieldEnum.check_manuel)) {
      data.check_manuel = body[Prisma.CarcasseIntermediaireScalarFieldEnum.check_manuel];
    }
    if (body.hasOwnProperty(Prisma.CarcasseIntermediaireScalarFieldEnum.manquante)) {
      data.manquante = body[Prisma.CarcasseIntermediaireScalarFieldEnum.manquante];
    }
    if (body.hasOwnProperty(Prisma.CarcasseIntermediaireScalarFieldEnum.refus)) {
      data.refus = body[Prisma.CarcasseIntermediaireScalarFieldEnum.refus];
    }
    if (body.hasOwnProperty(Prisma.CarcasseIntermediaireScalarFieldEnum.carcasse_check_finished_at)) {
      data.carcasse_check_finished_at =
        body[Prisma.CarcasseIntermediaireScalarFieldEnum.carcasse_check_finished_at];
    }

    const carcasseIntermediaire = await prisma.carcasseIntermediaire.upsert({
      where: {
        fei_numero__bracelet__intermediaire_id,
      },
      create: data,
      update: data,
    });

    res.status(200).send({
      ok: true,
      data: { carcasseIntermediaire },
      error: '',
    } satisfies CarcasseIntermediaireResponse);
  }),
);

router.get(
  '/:fei_numero/:intermediaire_id/:numero_bracelet',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!req.params.fei_numero) {
      res.status(400).send({ ok: false, data: null, error: 'Missing fei_numero' });
      return;
    }
    const fei = await prisma.fei.findUnique({
      where: {
        numero: req.params.fei_numero as string,
      },
    });
    if (!fei) {
      res.status(400).send({ ok: false, data: null, error: 'Unauthorized' });
      return;
    }
    if (!req.params.intermediaire_id) {
      res.status(400).send({ ok: false, data: null, error: 'Missing intermediaire_id' });
      return;
    }
    const carcasseIntermediaire = await prisma.carcasseIntermediaire.findUnique({
      where: {
        fei_numero__bracelet__intermediaire_id: getCarcasseIntermediaireId(
          req.params.fei_numero,
          req.params.numero_bracelet,
          req.params.intermediaire_id,
        ),
      },
    });
    if (!carcasseIntermediaire) {
      res.status(400).send({
        ok: false,
        data: null,
        error: 'Missing caracsse intermediaire',
      });
      return;
    }

    res.status(200).send({
      ok: true,
      data: { carcasseIntermediaire },
      error: '',
    });
  }),
);

export default router;
