import express from 'express';
import passport from 'passport';
import { catchErrors } from '../middlewares/errors';
import type { RequestWithUser } from '~/types/request';
const router = express.Router();
import prisma from '~/prisma';
import dayjs from 'dayjs';
import { sendEmail } from '~/third-parties/tipimail';
import { capture } from '~/third-parties/sentry';
import createUserId from '~/utils/createUserId';
import { comparePassword, hashPassword } from '~/service/crypto';
import validateUser from '~/middlewares/validateUser';
import {
  EntityRelationType,
  EntityTypes,
  Prisma,
  User,
  UserNotifications,
  UserRelationType,
  UserRoles,
} from '@prisma/client';
import { authorizeUserOrAdmin } from '~/utils/authorizeUserOrAdmin.server';

router.post(
  '/:fei_numero/:intermediaire_id/:numero_bracelet',
  passport.authenticate('user', { session: false }),
  catchErrors(
    async (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction,
    ) => {
      // Fetch the fiche data along with the required intervenants
      const body = req.body;
      const user = req.user;
      const { fei_numero, intermediaire_id, numero_bracelet } = req.params;
      if (!fei_numero) {
        res.status(400).send({
          ok: false,
          data: null,
          error: 'Le numéro de fiche est obligatoire',
        });
        return;
      }
      const existingFei = await prisma.fei.findUnique({
        where: { numero: fei_numero },
      });
      if (!existingFei) {
        res
          .status(400)
          .send({ ok: false, data: null, error: 'Fiche non trouvée' });
        return;
      }
      if (!numero_bracelet) {
        res.status(400).send({
          ok: false,
          data: null,
          error: 'Le numéro de la carcasse est obligatoire',
        });
        return;
      }
      console.log('numero_bracelet', numero_bracelet);
      const existingCarcasse = await prisma.carcasse.findFirst({
        where: {
          numero_bracelet: numero_bracelet,
          fei_numero: fei_numero,
        },
      });
      if (!existingCarcasse) {
        res
          .status(400)
          .send({ ok: false, data: null, error: 'Carcasse not found' });
        return;
      }
      if (!intermediaire_id) {
        res.status(400).send({
          ok: false,
          data: null,
          error: "L'identifiant du destinataire est obligatoire",
        });
        return;
      }
      const feiIntermediaire = await prisma.feiIntermediaire.findUnique({
        where: { id: intermediaire_id },
      });
      if (!feiIntermediaire) {
        res
          .status(400)
          .send({ ok: false, data: null, error: 'Intermediaire not found' });
        return;
      }

      const fei_numero__bracelet__intermediaire_id = `${fei_numero}__${numero_bracelet}__${intermediaire_id}`;
      const data: Prisma.CarcasseIntermediaireUncheckedCreateInput = {
        fei_numero__bracelet__intermediaire_id,
        fei_numero: fei_numero,
        numero_bracelet,
        zacharie_carcasse_id: existingCarcasse.zacharie_carcasse_id,
        fei_intermediaire_id: intermediaire_id,
        fei_intermediaire_user_id: user.id,
        fei_intermediaire_entity_id:
          feiIntermediaire.fei_intermediaire_entity_id,
      };
      if (
        body.hasOwnProperty(
          Prisma.CarcasseIntermediaireScalarFieldEnum.commentaire,
        )
      ) {
        data.commentaire =
          body[Prisma.CarcasseIntermediaireScalarFieldEnum.commentaire];
      }
      if (
        body[Prisma.CarcasseIntermediaireScalarFieldEnum.prise_en_charge] ===
        'true'
      ) {
        data.prise_en_charge = true;
        data.refus = null;
        data.carcasse_check_finished_at = new Date();
        const carcasseIntermediaire = await prisma.carcasseIntermediaire.upsert(
          {
            where: {
              fei_numero__bracelet__intermediaire_id,
            },
            create: data,
            update: data,
          },
        );
        // remove refus if there was one
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        // const carcasseUpdated = await prisma.carcasse.update({
        //   where: {
        //     numero_bracelet: numero_bracelet,
        //   },
        //   data: {
        //     intermediaire_carcasse_commentaire: null,
        //     intermediaire_carcasse_refus_motif: null,
        //     intermediaire_carcasse_refus_intermediaire_id: null,
        //     intermediaire_carcasse_signed_at: null,
        //   },
        // });

        res.status(200).send({
          ok: true,
          data: {
            carcasseIntermediaire,
          },
          error: '',
        });
        return;
      }

      if (
        body[Prisma.CarcasseIntermediaireScalarFieldEnum.manquante] === 'true'
      ) {
        console.log('MAAANQUANTE INDIRECTE API');
        data.manquante = true;
        data.prise_en_charge = false;
        data.refus = null;
        data.carcasse_check_finished_at = new Date();
        const carcasseIntermediaire = await prisma.carcasseIntermediaire.upsert(
          {
            where: {
              fei_numero__bracelet__intermediaire_id,
            },
            create: data,
            update: data,
          },
        );
        // remove refus if there was one
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        // const carcasseUpdated = await prisma.carcasse.update({
        //   where: {
        //     numero_bracelet: numero_bracelet,
        //   },
        //   data: {
        //     intermediaire_carcasse_manquante: true,
        //     intermediaire_carcasse_refus_motif: null,
        //     intermediaire_carcasse_signed_at: new Date(),
        //   },
        // });

        res.status(200).send({
          ok: true,
          data: {
            carcasseIntermediaire,
          },
          error: '',
        });
        return;
      }

      if (body[Prisma.CarcasseIntermediaireScalarFieldEnum.refus]) {
        data.refus = body[Prisma.CarcasseIntermediaireScalarFieldEnum.refus];
        data.manquante = false;
        data.prise_en_charge = false;
        data.carcasse_check_finished_at = new Date();
        const carcasseIntermediaire = await prisma.carcasseIntermediaire.upsert(
          {
            where: {
              fei_numero__bracelet__intermediaire_id,
            },
            create: data,
            update: data,
          },
        );
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        // await prisma.carcasse.update({
        //   where: {
        //     numero_bracelet: numero_bracelet,
        //   },
        //   data: {
        //     intermediaire_carcasse_commentaire: data.commentaire,
        //     intermediaire_carcasse_refus_motif: data.refus,
        //     intermediaire_carcasse_refus_intermediaire_id: intermediaire_id,
        //     intermediaire_carcasse_signed_at: new Date(),
        //   },
        // });
        res.status(200).send({
          ok: true,
          data: {
            carcasseIntermediaire,
          },
          error: '',
        });
        return;
      }

      res.status(200).send({
        ok: true,
        data: null,
        error: '',
      });
    },
  ),
);

router.get(
  '/:fei_numero/:intermediaire_id/:numero_bracelet',
  passport.authenticate('user', { session: false }),
  catchErrors(
    async (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction,
    ) => {
      if (!req.params.fei_numero) {
        res
          .status(400)
          .send({ ok: false, data: null, error: 'Missing fei_numero' });
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
        res
          .status(400)
          .send({ ok: false, data: null, error: 'Missing intermediaire_id' });
        return;
      }
      const carcasseIntermediaire =
        await prisma.carcasseIntermediaire.findUnique({
          where: {
            fei_numero__bracelet__intermediaire_id: `${req.params.fei_numero}__${req.params.numero_bracelet}__${req.params.intermediaire_id}`,
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
    },
  ),
);

export default router;
