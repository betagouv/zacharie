import express from 'express';
import passport from 'passport';
import { catchErrors } from '../middlewares/errors';
import type { CarcasseResponse, CarcassesGetForRegistryResponse } from '~/types/responses';
const router: express.Router = express.Router();
import prisma from '~/prisma';
import dayjs from 'dayjs';
import { EntityRelationType, Prisma, UserRoles } from '@prisma/client';
import sendNotificationToUser from '~/service/notifications';
import { formatCarcasseEmail } from '~/utils/formatCarcasseEmail';
import { RequestWithUser } from '~/types/request';
import { carcasseForRegistrySelect } from '~/types/carcasse';
import updateCarcasseStatus from '~/utils/get-carcasse-status';

router.post(
  '/:fei_numero/:zacharie_carcasse_id',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const body: Prisma.CarcasseUncheckedCreateInput = req.body;
    const user = req.user;
    const { fei_numero, zacharie_carcasse_id } = req.params;
    if (!fei_numero) {
      res.status(400).send({
        ok: false,
        data: { carcasse: null },
        error: 'Le numéro de fiche est obligatoire',
      } satisfies CarcasseResponse);
      return;
    }
    const existingFei = await prisma.fei.findUnique({
      where: { numero: fei_numero },
    });
    if (!existingFei) {
      res
        .status(404)
        .send({ ok: false, data: { carcasse: null }, error: 'Fiche non trouvée' } satisfies CarcasseResponse);
      return;
    }
    if (!zacharie_carcasse_id) {
      res.status(400).send({
        ok: false,
        data: { carcasse: null },
        error: 'Le numéro de la carcasse est obligatoire',
      } satisfies CarcasseResponse);
      return;
    }
    let existingCarcasse = await prisma.carcasse.findFirst({
      where: {
        zacharie_carcasse_id: zacharie_carcasse_id,
        fei_numero: fei_numero,
      },
    });
    if (!existingCarcasse) {
      const numeroBracelet = body.numero_bracelet;
      if (!numeroBracelet) {
        res.status(400).send({
          ok: false,
          data: { carcasse: null },
          error: 'Le numéro de marquage est obligatoire',
        } satisfies CarcasseResponse);
        return;
      }
      existingCarcasse = await prisma.carcasse.create({
        data: {
          zacharie_carcasse_id,
          fei_numero,
          numero_bracelet: body.numero_bracelet,
          is_synced: true,
        },
      });
    }

    if (body.deleted_at) {
      const existinCarcasse = await prisma.carcasse.findFirst({
        where: {
          zacharie_carcasse_id,
          fei_numero: fei_numero,
        },
      });
      if (!existinCarcasse) {
        res.status(200).send({ ok: true, data: { carcasse: null }, error: '' } satisfies CarcasseResponse);
        return;
      }
      const deletedCarcasse = await prisma.carcasse.update({
        where: {
          zacharie_carcasse_id: existinCarcasse.zacharie_carcasse_id,
        },
        data: {
          deleted_at: body.deleted_at,
          is_synced: true,
        },
      });
      await prisma.carcasseIntermediaire.deleteMany({
        where: {
          zacharie_carcasse_id: existinCarcasse.zacharie_carcasse_id,
        },
      });
      res
        .status(200)
        .send({ ok: true, data: { carcasse: deletedCarcasse }, error: '' } satisfies CarcasseResponse);
      return;
    }

    const nextCarcasse: Prisma.CarcasseUncheckedUpdateInput = {
      is_synced: true,
    };

    if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.numero_bracelet)) {
      nextCarcasse.numero_bracelet = body.numero_bracelet;
    }
    if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.heure_evisceration)) {
      nextCarcasse.heure_evisceration = body.heure_evisceration;
    }
    if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.type)) {
      nextCarcasse.type = body[Prisma.CarcasseScalarFieldEnum.type];
    }
    if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.nombre_d_animaux)) {
      nextCarcasse.nombre_d_animaux = Number(body[Prisma.CarcasseScalarFieldEnum.nombre_d_animaux]);
    }
    if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.heure_mise_a_mort)) {
      nextCarcasse.heure_mise_a_mort = body[Prisma.CarcasseScalarFieldEnum.heure_mise_a_mort];
    }
    if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.espece)) {
      nextCarcasse.espece = body[Prisma.CarcasseScalarFieldEnum.espece];
    }
    if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.categorie)) {
      nextCarcasse.categorie = body[Prisma.CarcasseScalarFieldEnum.categorie];
    }
    if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.examinateur_carcasse_sans_anomalie)) {
      const nextValue = body[Prisma.CarcasseScalarFieldEnum.examinateur_carcasse_sans_anomalie];
      nextCarcasse.examinateur_carcasse_sans_anomalie = nextValue;
      if (nextValue === true) {
        nextCarcasse.examinateur_anomalies_carcasse = [];
        nextCarcasse.examinateur_anomalies_abats = [];
      }
    }
    if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.examinateur_anomalies_carcasse)) {
      const anomaliesCarcasses = (body.examinateur_anomalies_carcasse as string[]) || [];
      nextCarcasse.examinateur_anomalies_carcasse = anomaliesCarcasses.filter(Boolean);
    }
    if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.examinateur_anomalies_abats)) {
      const anomaliesAbats = (body.examinateur_anomalies_abats as string[]) || [];
      nextCarcasse.examinateur_anomalies_abats = anomaliesAbats.filter(Boolean);
    }
    if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.examinateur_commentaire)) {
      nextCarcasse.examinateur_commentaire = body[Prisma.CarcasseScalarFieldEnum.examinateur_commentaire];
    }
    if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.examinateur_signed_at)) {
      nextCarcasse.examinateur_signed_at = body.examinateur_signed_at;
    }
    if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.intermediaire_carcasse_signed_at)) {
      nextCarcasse.intermediaire_carcasse_signed_at = body.intermediaire_carcasse_signed_at;
    }
    if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.intermediaire_carcasse_manquante)) {
      const nextValue = body[Prisma.CarcasseScalarFieldEnum.intermediaire_carcasse_manquante];
      nextCarcasse.intermediaire_carcasse_manquante = nextValue;
    }
    if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.intermediaire_carcasse_refus_intermediaire_id)) {
      nextCarcasse.intermediaire_carcasse_refus_intermediaire_id =
        body[Prisma.CarcasseScalarFieldEnum.intermediaire_carcasse_refus_intermediaire_id];
    }
    if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.intermediaire_carcasse_refus_motif)) {
      nextCarcasse.intermediaire_carcasse_refus_motif =
        body[Prisma.CarcasseScalarFieldEnum.intermediaire_carcasse_refus_motif];
    }
    if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.intermediaire_carcasse_commentaire)) {
      nextCarcasse.intermediaire_carcasse_commentaire =
        body[Prisma.CarcasseScalarFieldEnum.intermediaire_carcasse_commentaire];
    }
    if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_assigned_to_fei_at)) {
      nextCarcasse.svi_assigned_to_fei_at = body.svi_assigned_to_fei_at;
    }

    if (user.roles.includes(UserRoles.SVI)) {
      if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_carcasse_consigne)) {
        nextCarcasse.svi_carcasse_consigne = body.svi_carcasse_consigne;
      }
      if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_carcasse_manquante)) {
        nextCarcasse.svi_carcasse_manquante = body.svi_carcasse_manquante;
      }
      if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_carcasse_consigne_at)) {
        nextCarcasse.svi_carcasse_consigne_at = body.svi_carcasse_consigne_at;
      }
      if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_carcasse_consigne_motif)) {
        nextCarcasse.svi_carcasse_consigne_motif = (body.svi_carcasse_consigne_motif as string[]).filter(
          Boolean,
        );
      }
      if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_carcasse_traitement_assainissant)) {
        nextCarcasse.svi_carcasse_traitement_assainissant = (
          body.svi_carcasse_traitement_assainissant as string[]
        ).filter(Boolean);
      }
      if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_carcasse_consigne_levee)) {
        nextCarcasse.svi_carcasse_consigne_levee = body.svi_carcasse_consigne_levee;
      }
      if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_carcasse_consigne_levee_at)) {
        nextCarcasse.svi_carcasse_consigne_levee_at = body.svi_carcasse_consigne_levee_at;
      }
      if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_carcasse_saisie)) {
        nextCarcasse.svi_carcasse_saisie = (body.svi_carcasse_saisie as string[]).filter(Boolean);
      }
      if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_carcasse_saisie_motif)) {
        nextCarcasse.svi_carcasse_saisie_motif = (body.svi_carcasse_saisie_motif as string[]).filter(Boolean);
      }
      if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_carcasse_saisie_at)) {
        nextCarcasse.svi_carcasse_saisie_at = body.svi_carcasse_saisie_at;
      }
      if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_carcasse_signed_at)) {
        nextCarcasse.svi_carcasse_signed_at = body.svi_carcasse_signed_at;
      }
      if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_carcasse_commentaire)) {
        nextCarcasse.svi_carcasse_commentaire = body[Prisma.CarcasseScalarFieldEnum.svi_carcasse_commentaire];
      }
      if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_carcasse_status)) {
        nextCarcasse.svi_carcasse_status = body[Prisma.CarcasseScalarFieldEnum.svi_carcasse_status];
      }
      if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_carcasse_status_set_at)) {
        nextCarcasse.svi_carcasse_status_set_at =
          body[Prisma.CarcasseScalarFieldEnum.svi_carcasse_status_set_at];
      }
    }

    const updatedCarcasse = await prisma.carcasse.update({
      where: {
        zacharie_carcasse_id: existingCarcasse.zacharie_carcasse_id,
      },
      data: nextCarcasse,
    });

    if (!existingCarcasse.svi_carcasse_saisie.length && updatedCarcasse.svi_carcasse_saisie.length) {
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
          return [fei?.FeiExaminateurInitialUser, fei?.FeiPremierDetenteurUser];
        });

      const email = formatCarcasseEmail(updatedCarcasse);

      sendNotificationToUser({
        user: examinateurInitial!,
        title: `Une carcasse de ${existingCarcasse.espece} a été saisie`,
        body: `Motif${
          updatedCarcasse.svi_carcasse_saisie_motif.length > 1 ? 's' : ''
        } de saisie: ${updatedCarcasse.svi_carcasse_saisie_motif.join(', ')}`,
        email: email,
        notificationLogAction: `CARCASSE_SAISIE_${existingCarcasse.zacharie_carcasse_id}`,
      });

      if (premierDetenteur?.id !== examinateurInitial?.id) {
        sendNotificationToUser({
          user: premierDetenteur!,
          title: `Une carcasse de ${existingCarcasse.espece} a été saisie`,
          body: `Motif${
            updatedCarcasse.svi_carcasse_saisie_motif.length > 1 ? 's' : ''
          } de saisie: ${updatedCarcasse.svi_carcasse_saisie_motif.join(', ')}`,
          email: email,
          notificationLogAction: `CARCASSE_SAISIE_${existingCarcasse.zacharie_carcasse_id}`,
        });
      }
    }

    if (
      !existingCarcasse.intermediaire_carcasse_manquante &&
      updatedCarcasse.intermediaire_carcasse_manquante
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
          return [fei?.FeiExaminateurInitialUser, fei?.FeiPremierDetenteurUser];
        });

      const email = formatCarcasseEmail(updatedCarcasse);

      sendNotificationToUser({
        user: examinateurInitial!,
        title: `Une carcasse de ${existingCarcasse.espece} est manquante`,
        body: '',
        email: email,
        notificationLogAction: `CARCASSE_MANQUANTE_${existingCarcasse.zacharie_carcasse_id}`,
      });

      if (premierDetenteur?.id !== examinateurInitial?.id) {
        sendNotificationToUser({
          user: premierDetenteur!,
          title: `Une carcasse de ${existingCarcasse.espece} est manquante`,
          body: '',
          email: email,
          notificationLogAction: `CARCASSE_MANQUANTE_${existingCarcasse.zacharie_carcasse_id}`,
        });
      }
    }

    if (
      !existingCarcasse.intermediaire_carcasse_refus_intermediaire_id &&
      updatedCarcasse.intermediaire_carcasse_refus_intermediaire_id
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
          return [fei?.FeiExaminateurInitialUser, fei?.FeiPremierDetenteurUser];
        });

      const email = formatCarcasseEmail(updatedCarcasse);
      sendNotificationToUser({
        user: examinateurInitial!,
        title: `Une carcasse de ${existingCarcasse.espece} est refusée`,
        body: `Motif de refus: ${updatedCarcasse.intermediaire_carcasse_refus_motif}`,
        email: email,
        notificationLogAction: `CARCASSE_REFUS_${existingCarcasse.zacharie_carcasse_id}`,
      });

      if (premierDetenteur?.id !== examinateurInitial?.id) {
        sendNotificationToUser({
          user: premierDetenteur!,
          title: `Une carcasse de ${existingCarcasse.espece} a été saisie`,
          body: `Motif de refus: ${updatedCarcasse.intermediaire_carcasse_refus_motif}`,
          email: email,
          notificationLogAction: `CARCASSE_MANQUANTE_${existingCarcasse.zacharie_carcasse_id}`,
        });
      }
    }

    res.status(200).send({
      ok: true,
      data: { carcasse: updatedCarcasse },
      error: '',
    } satisfies CarcasseResponse);
  }),
);

router.get(
  '/svi',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response) => {
    // Parse and validate query parameters
    const { page = '0', after, limit = '100', withDeleted = 'false' } = req.query as Record<string, string>;

    const parsedPage = Math.max(0, parseInt(page, 10) || 0);
    const parsedLimit = parseInt(limit, 10) || 10000;
    const includeDeleted = withDeleted === 'true';
    const afterDate = after && !isNaN(Number(after)) ? new Date(Number(after)) : null;

    console.log('afterDate', afterDate);
    // Base query conditions
    const where: Prisma.CarcasseWhereInput = {
      Fei: {
        svi_assigned_at: { not: null },
        FeiSviEntity: {
          EntityRelatedWithUser: {
            some: {
              owner_id: req.user!.id,
              relation: EntityRelationType.WORKING_FOR,
            },
          },
        },
      },
    };
    if (!includeDeleted) {
      where.deleted_at = null;
    }

    if (afterDate) {
      if (includeDeleted) {
        where.OR = [
          // If we include deleted, we want to get all the carcasses updated after the date
          { updated_at: { gte: afterDate } },
          // And all the carcasses deleted after the date
          { deleted_at: { gte: afterDate } },
        ];
      } else {
        where.updated_at = { gte: afterDate };
      }
    }

    // Execute count and findMany in parallel
    const [total, data] = await Promise.all([
      prisma.carcasse.count({ where }),
      prisma.carcasse.findMany({
        where,
        select: carcasseForRegistrySelect,
        orderBy: { created_at: 'desc' },
        skip: parsedPage * parsedLimit,
        take: parsedLimit,
      }),
    ]);

    const now = dayjs();

    res.status(200).json({
      ok: true,
      data: {
        carcasses: data.map((carcasse) => {
          const fei = carcasse.Fei;
          return {
            ...carcasse,
            svi_carcasse_status: carcasse.svi_carcasse_status || updateCarcasseStatus(carcasse),
            svi_carcasse_status_set_at:
              carcasse.svi_carcasse_status_set_at || fei.automatic_closed_at || fei.svi_signed_at,
            svi_assigned_to_fei_at: carcasse.svi_assigned_to_fei_at || fei.svi_assigned_at,
            premier_detenteur_name_cache: fei.premier_detenteur_name_cache,
            // svi_carcasse_archived: fei.automatic_closed_at || fei.svi_signed_at,
            svi_carcasse_archived:
              !!fei.automatic_closed_at || dayjs(now).diff(fei.svi_assigned_at, 'day') > 10,
          };
        }),
        hasMore: data.length === parsedLimit,
        total,
      },
      error: '',
    } satisfies CarcassesGetForRegistryResponse);
  }),
);

router.get(
  '/:fei_numero/:numero_bracelet',
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
  }),
);

router.get(
  '/:zacharie_carcasse_id',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const carcasse = await prisma.carcasse.findUnique({
      where: {
        zacharie_carcasse_id: req.params.zacharie_carcasse_id,
      },
      include: {
        Fei: true,
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
    } satisfies CarcasseResponse);
  }),
);

export default router;
