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
import sendNotificationToUser from '~/service/notifications';

router.post(
  '/:fei_numero/:numero_bracelet',
  passport.authenticate('user', { session: false }),
  catchErrors(
    async (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction,
    ) => {
      interface CarcasseBody extends Prisma.CarcasseUncheckedCreateInput {
        _action?: string;
      }
      const body: CarcasseBody = req.body;
      const user = req.user;
      const { fei_numero, numero_bracelet } = req.params;
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

      if (body._action === 'delete') {
        const existinCarcasse = await prisma.carcasse.findFirst({
          where: {
            numero_bracelet,
            fei_numero: fei_numero,
          },
        });
        if (existinCarcasse) {
          await prisma.carcasse.update({
            where: {
              zacharie_carcasse_id: existinCarcasse.zacharie_carcasse_id,
            },
            data: {
              deleted_at: dayjs().toISOString(),
            },
          });
        }
        res.status(200).send({ ok: true, data: null, error: '' });
        return;
      }

      const nextCarcasse: Prisma.CarcasseUncheckedUpdateInput = {};

      if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.numero_bracelet)) {
        nextCarcasse.numero_bracelet = body.numero_bracelet;
      }
      if (
        body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.heure_evisceration)
      ) {
        nextCarcasse.heure_evisceration = body.heure_evisceration;
      }
      if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.type)) {
        nextCarcasse.type = body[Prisma.CarcasseScalarFieldEnum.type];
      }
      if (
        body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.nombre_d_animaux)
      ) {
        nextCarcasse.nombre_d_animaux = Number(
          body[Prisma.CarcasseScalarFieldEnum.nombre_d_animaux],
        );
      }
      if (
        body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.heure_mise_a_mort)
      ) {
        nextCarcasse.heure_mise_a_mort =
          body[Prisma.CarcasseScalarFieldEnum.heure_mise_a_mort];
      }
      if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.espece)) {
        nextCarcasse.espece = body[Prisma.CarcasseScalarFieldEnum.espece];
      }
      if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.categorie)) {
        nextCarcasse.categorie = body[Prisma.CarcasseScalarFieldEnum.categorie];
      }
      if (
        body.hasOwnProperty(
          Prisma.CarcasseScalarFieldEnum.examinateur_carcasse_sans_anomalie,
        )
      ) {
        const nextValue =
          body[
            Prisma.CarcasseScalarFieldEnum.examinateur_carcasse_sans_anomalie
          ];
        nextCarcasse.examinateur_carcasse_sans_anomalie = nextValue;
        if (nextValue === true) {
          nextCarcasse.examinateur_anomalies_carcasse = [];
          nextCarcasse.examinateur_anomalies_abats = [];
        }
      }
      if (
        body.hasOwnProperty(
          Prisma.CarcasseScalarFieldEnum.examinateur_anomalies_carcasse,
        )
      ) {
        const anomaliesCarcasses =
          (body.examinateur_anomalies_carcasse as string[]) || [];
        nextCarcasse.examinateur_anomalies_carcasse =
          anomaliesCarcasses.filter(Boolean);
      }
      if (
        body.hasOwnProperty(
          Prisma.CarcasseScalarFieldEnum.examinateur_anomalies_abats,
        )
      ) {
        const anomaliesAbats =
          (body.examinateur_anomalies_abats as string[]) || [];
        nextCarcasse.examinateur_anomalies_abats =
          anomaliesAbats.filter(Boolean);
      }
      if (
        body.hasOwnProperty(
          Prisma.CarcasseScalarFieldEnum.examinateur_commentaire,
        )
      ) {
        nextCarcasse.examinateur_commentaire =
          body[Prisma.CarcasseScalarFieldEnum.examinateur_commentaire];
      }
      if (
        body.hasOwnProperty(
          Prisma.CarcasseScalarFieldEnum.examinateur_signed_at,
        )
      ) {
        if (body[Prisma.CarcasseScalarFieldEnum.examinateur_signed_at] === '') {
          nextCarcasse.examinateur_signed_at = null;
        } else {
          nextCarcasse.examinateur_signed_at = new Date(
            body.examinateur_signed_at!,
          );
        }
      }

      if (
        body.hasOwnProperty(
          Prisma.CarcasseScalarFieldEnum.intermediaire_carcasse_signed_at,
        )
      ) {
        if (body.intermediaire_carcasse_signed_at === '') {
          nextCarcasse.intermediaire_carcasse_signed_at = null;
        } else {
          nextCarcasse.intermediaire_carcasse_signed_at = new Date(
            body.intermediaire_carcasse_signed_at!,
          );
        }
      }
      if (
        body.hasOwnProperty(
          Prisma.CarcasseScalarFieldEnum.intermediaire_carcasse_manquante,
        )
      ) {
        const nextValue =
          body[Prisma.CarcasseScalarFieldEnum.intermediaire_carcasse_manquante];
        nextCarcasse.intermediaire_carcasse_manquante = nextValue;
      }
      if (
        body.hasOwnProperty(
          Prisma.CarcasseScalarFieldEnum
            .intermediaire_carcasse_refus_intermediaire_id,
        )
      ) {
        nextCarcasse.intermediaire_carcasse_refus_intermediaire_id =
          body[
            Prisma.CarcasseScalarFieldEnum.intermediaire_carcasse_refus_intermediaire_id
          ];
      }
      if (
        body.hasOwnProperty(
          Prisma.CarcasseScalarFieldEnum.intermediaire_carcasse_refus_motif,
        )
      ) {
        nextCarcasse.intermediaire_carcasse_refus_motif =
          body[
            Prisma.CarcasseScalarFieldEnum.intermediaire_carcasse_refus_motif
          ];
      }
      if (
        body.hasOwnProperty(
          Prisma.CarcasseScalarFieldEnum.intermediaire_carcasse_commentaire,
        )
      ) {
        nextCarcasse.intermediaire_carcasse_commentaire =
          body[
            Prisma.CarcasseScalarFieldEnum.intermediaire_carcasse_commentaire
          ];
      }

      if (user.roles.includes(UserRoles.SVI)) {
        if (
          body.hasOwnProperty(
            Prisma.CarcasseScalarFieldEnum.svi_carcasse_saisie,
          )
        ) {
          nextCarcasse.svi_carcasse_saisie = (
            body.svi_carcasse_saisie as string[]
          ).filter(Boolean);
        }
        if (
          body.hasOwnProperty(
            Prisma.CarcasseScalarFieldEnum.svi_carcasse_saisie_motif,
          )
        ) {
          nextCarcasse.svi_carcasse_saisie_motif = (
            body.svi_carcasse_saisie_motif as string[]
          ).filter(Boolean);
        }
        if (
          body.hasOwnProperty(
            Prisma.CarcasseScalarFieldEnum.svi_carcasse_saisie_at,
          )
        ) {
          const saisieAt =
            body[Prisma.CarcasseScalarFieldEnum.svi_carcasse_saisie_at];
          if (saisieAt !== '') {
            nextCarcasse.svi_carcasse_saisie_at = dayjs(
              saisieAt || undefined,
            ).toISOString();
            nextCarcasse.svi_carcasse_signed_at = null;
          }
        }
        if (body[Prisma.CarcasseScalarFieldEnum.svi_carcasse_signed_at]) {
          const signedAt =
            body[Prisma.CarcasseScalarFieldEnum.svi_carcasse_signed_at];
          if (signedAt !== '') {
            nextCarcasse.svi_carcasse_signed_at = dayjs(
              signedAt || undefined,
            ).toISOString();
            nextCarcasse.svi_carcasse_saisie_at = null;
            nextCarcasse.svi_carcasse_saisie_motif = [];
            nextCarcasse.svi_carcasse_saisie = [];
          }
        }
        if (
          body.hasOwnProperty(
            Prisma.CarcasseScalarFieldEnum.svi_carcasse_commentaire,
          )
        ) {
          nextCarcasse.svi_carcasse_commentaire =
            body[Prisma.CarcasseScalarFieldEnum.svi_carcasse_commentaire];
        }
      }

      const updatedCarcasse = await prisma.carcasse.update({
        where: {
          zacharie_carcasse_id: existingCarcasse.zacharie_carcasse_id,
        },
        data: nextCarcasse,
      });

      if (
        !existingCarcasse.svi_carcasse_saisie.length &&
        updatedCarcasse.svi_carcasse_saisie.length
      ) {
        const [examinateurInitial, premierDetenteur] = await prisma.fei
          .findUnique({
            where: {
              numero: existingCarcasse.fei_numero,
            },
            include: {
              FeiExaminateurInitialUser: true,
              FeiPremierDetenteurUser: true,
            },
          })
          .then((fei) => {
            return [
              fei?.FeiExaminateurInitialUser,
              fei?.FeiPremierDetenteurUser,
            ];
          });

        const email = [
          `Carcasse de ${existingCarcasse.espece}`,
          `Nombre d'animaux\u00A0: ${existingCarcasse.nombre_d_animaux}`,
          `Numéro d'identification\u00A0: ${existingCarcasse.numero_bracelet}`,
          `Décision de saisie\u00A0: ${updatedCarcasse.svi_carcasse_saisie.join(
            ' - ',
          )}`,
          `Motifs de saisie\u00A0:\n${updatedCarcasse.svi_carcasse_saisie_motif
            .map((motif) => ` -> ${motif}`)
            .join('\n')}`,
          `Commentaire\u00A0:\n${updatedCarcasse.svi_carcasse_commentaire}`,
          `Rendez-vous sur Zacharie pour consulter le détail de la carcasse : https://zacharie.agriculture.gouv.fr/carcasse-svi/${existingCarcasse.fei_numero}/${existingCarcasse.numero_bracelet}`,
        ];

        sendNotificationToUser({
          user: examinateurInitial!,
          title: `Une carcasse de ${existingCarcasse.espece} a été saisie`,
          body: `Motif${
            updatedCarcasse.svi_carcasse_saisie_motif.length > 1 ? 's' : ''
          } de saisie: ${updatedCarcasse.svi_carcasse_saisie_motif.join(', ')}`,
          email: email.join('\n'),
          notificationLogAction: `CARCASSE_SAISIE_${existingCarcasse.numero_bracelet}`,
        });

        if (premierDetenteur?.id !== examinateurInitial?.id) {
          sendNotificationToUser({
            user: premierDetenteur!,
            title: `Une carcasse de ${existingCarcasse.espece} a été saisie`,
            body: `Motif${
              updatedCarcasse.svi_carcasse_saisie_motif.length > 1 ? 's' : ''
            } de saisie: ${updatedCarcasse.svi_carcasse_saisie_motif.join(
              ', ',
            )}`,
            email: email.join('\n'),
            notificationLogAction: `CARCASSE_SAISIE_${existingCarcasse.numero_bracelet}`,
          });
        }
      }

      res.status(200).send({
        ok: true,
        data: { carcasse: updatedCarcasse },
        error: '',
      });
    },
  ),
);

router.get(
  '/:fei_numero/:numero_bracelet',
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

      const carcasse = await prisma.carcasse.findFirst({
        where: {
          numero_bracelet: req.params.numero_bracelet,
          fei_numero: req.params.fei_numero,
        },
      });
      if (!carcasse) {
        res.status(400).send({ ok: false, data: null, error: 'Unauthorized' });
        return;
      }

      res.status(200).send({
        ok: true,
        data: { carcasse },
        error: '',
      });
    },
  ),
);

router.get(
  '/:zacharie_carcasse_id',
  passport.authenticate('user', { session: false }),
  catchErrors(
    async (
      req: express.Request,
      res: express.Response,
      next: express.NextFunction,
    ) => {
      const carcasse = await prisma.carcasse.findUnique({
        where: {
          zacharie_carcasse_id: req.params.zacharie_carcasse_id,
        },
      });
      if (!carcasse) {
        res.status(400).send({ ok: false, data: null, error: 'Unauthorized' });
        return;
      }

      res.status(200).send({
        ok: true,
        data: { carcasse },
        error: '',
      });
    },
  ),
);

export default router;
