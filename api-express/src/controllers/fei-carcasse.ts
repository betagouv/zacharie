import express from 'express';
import passport from 'passport';
import { catchErrors } from '../middlewares/errors';
import type { CarcasseResponse, CarcassesGetForRegistryResponse } from '~/types/responses';
const router: express.Router = express.Router();
import prisma from '~/prisma';
import dayjs from 'dayjs';
import { EntityRelationType, IPM2Decision, Prisma, UserRoles } from '@prisma/client';
import sendNotificationToUser from '~/service/notifications';
import { formatCarcasseChasseurEmail } from '~/utils/formatCarcasseEmail';
import { RequestWithUser } from '~/types/request';
import { carcasseForRegistrySelect, CarcasseForResponseForRegistry } from '~/types/carcasse';
import updateCarcasseStatus from '~/utils/get-carcasse-status';
import { checkGenerateCertificat } from '~/utils/generate-certificats';

// prisma.carcasse
//   .findMany({
//     where: {},
//   })
//   .then(async (carcasses) => {
//     for (const carcasse of carcasses) {
//       const status = updateCarcasseStatus(carcasse);
//       await prisma.carcasse.update({
//         where: { zacharie_carcasse_id: carcasse.zacharie_carcasse_id },
//         data: { svi_carcasse_status: status },
//       });
//     }
//     console.log('done');
//   });

router.post(
  '/:fei_numero/:zacharie_carcasse_id',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const body: Prisma.CarcasseUncheckedCreateInput = req.body;
    const user = req.user;
    const { fei_numero, zacharie_carcasse_id } = req.params;
    console.log('body.svi_carcasse_status', body.svi_carcasse_status);
    console.log('body', body);
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
    if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.latest_intermediaire_signed_at)) {
      nextCarcasse.latest_intermediaire_signed_at = body.latest_intermediaire_signed_at;
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
    if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_assigned_to_fei_at)) {
      nextCarcasse.svi_assigned_to_fei_at = body.svi_assigned_to_fei_at;
    }
    if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_carcasse_status)) {
      nextCarcasse.svi_carcasse_status = body[Prisma.CarcasseScalarFieldEnum.svi_carcasse_status];
      console.log('nextCarcasse.svi_carcasse_status', nextCarcasse.svi_carcasse_status);
    }
    if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_carcasse_status_set_at)) {
      nextCarcasse.svi_carcasse_status_set_at =
        body[Prisma.CarcasseScalarFieldEnum.svi_carcasse_status_set_at];
    }

    if (user.roles.includes(UserRoles.SVI)) {
      if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_carcasse_commentaire)) {
        nextCarcasse.svi_carcasse_commentaire = body[Prisma.CarcasseScalarFieldEnum.svi_carcasse_commentaire];
      }
      if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_ipm1_date)) {
        nextCarcasse.svi_ipm1_date = body[Prisma.CarcasseScalarFieldEnum.svi_ipm1_date];
      }
      if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_ipm1_presentee_inspection)) {
        nextCarcasse.svi_ipm1_presentee_inspection =
          body[Prisma.CarcasseScalarFieldEnum.svi_ipm1_presentee_inspection];
      }
      if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_ipm1_user_id)) {
        nextCarcasse.svi_ipm1_user_id = body[Prisma.CarcasseScalarFieldEnum.svi_ipm1_user_id];
      }
      if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_ipm1_user_name_cache)) {
        nextCarcasse.svi_ipm1_user_name_cache = body[Prisma.CarcasseScalarFieldEnum.svi_ipm1_user_name_cache];
      }
      if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_ipm1_protocole)) {
        nextCarcasse.svi_ipm1_protocole = body[Prisma.CarcasseScalarFieldEnum.svi_ipm1_protocole];
      }
      if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_ipm1_pieces)) {
        nextCarcasse.svi_ipm1_pieces = body[Prisma.CarcasseScalarFieldEnum.svi_ipm1_pieces];
      }
      if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_ipm1_lesions_ou_motifs)) {
        nextCarcasse.svi_ipm1_lesions_ou_motifs =
          body[Prisma.CarcasseScalarFieldEnum.svi_ipm1_lesions_ou_motifs];
      }
      if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_ipm1_nombre_animaux)) {
        nextCarcasse.svi_ipm1_nombre_animaux = body[Prisma.CarcasseScalarFieldEnum.svi_ipm1_nombre_animaux];
      }
      if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_ipm1_commentaire)) {
        nextCarcasse.svi_ipm1_commentaire = body[Prisma.CarcasseScalarFieldEnum.svi_ipm1_commentaire];
      }
      if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_ipm1_decision)) {
        nextCarcasse.svi_ipm1_decision = body[Prisma.CarcasseScalarFieldEnum.svi_ipm1_decision];
      }
      if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_ipm1_duree_consigne)) {
        nextCarcasse.svi_ipm1_duree_consigne = body[Prisma.CarcasseScalarFieldEnum.svi_ipm1_duree_consigne];
      }
      if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_ipm1_poids_consigne)) {
        nextCarcasse.svi_ipm1_poids_consigne = body[Prisma.CarcasseScalarFieldEnum.svi_ipm1_poids_consigne];
      }
      if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_ipm1_signed_at)) {
        nextCarcasse.svi_ipm1_signed_at = body[Prisma.CarcasseScalarFieldEnum.svi_ipm1_signed_at];
      }
      if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_ipm2_date)) {
        nextCarcasse.svi_ipm2_date = body[Prisma.CarcasseScalarFieldEnum.svi_ipm2_date];
      }
      if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_ipm2_presentee_inspection)) {
        nextCarcasse.svi_ipm2_presentee_inspection =
          body[Prisma.CarcasseScalarFieldEnum.svi_ipm2_presentee_inspection];
      }
      if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_ipm2_user_id)) {
        nextCarcasse.svi_ipm2_user_id = body[Prisma.CarcasseScalarFieldEnum.svi_ipm2_user_id];
      }
      if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_ipm2_user_name_cache)) {
        nextCarcasse.svi_ipm2_user_name_cache = body[Prisma.CarcasseScalarFieldEnum.svi_ipm2_user_name_cache];
      }
      if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_ipm2_protocole)) {
        nextCarcasse.svi_ipm2_protocole = body[Prisma.CarcasseScalarFieldEnum.svi_ipm2_protocole];
      }
      if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_ipm2_pieces)) {
        nextCarcasse.svi_ipm2_pieces = body[Prisma.CarcasseScalarFieldEnum.svi_ipm2_pieces];
      }
      if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_ipm2_lesions_ou_motifs)) {
        nextCarcasse.svi_ipm2_lesions_ou_motifs =
          body[Prisma.CarcasseScalarFieldEnum.svi_ipm2_lesions_ou_motifs];
      }
      if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_ipm2_nombre_animaux)) {
        nextCarcasse.svi_ipm2_nombre_animaux = body[Prisma.CarcasseScalarFieldEnum.svi_ipm2_nombre_animaux];
      }
      if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_ipm2_commentaire)) {
        nextCarcasse.svi_ipm2_commentaire = body[Prisma.CarcasseScalarFieldEnum.svi_ipm2_commentaire];
      }
      if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_ipm2_decision)) {
        nextCarcasse.svi_ipm2_decision = body[Prisma.CarcasseScalarFieldEnum.svi_ipm2_decision];
      }
      if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_ipm2_traitement_assainissant)) {
        nextCarcasse.svi_ipm2_traitement_assainissant =
          body[Prisma.CarcasseScalarFieldEnum.svi_ipm2_traitement_assainissant];
      }
      if (
        body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_ipm2_traitement_assainissant_cuisson_temps)
      ) {
        nextCarcasse.svi_ipm2_traitement_assainissant_cuisson_temps =
          body[Prisma.CarcasseScalarFieldEnum.svi_ipm2_traitement_assainissant_cuisson_temps];
      }
      if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_ipm2_traitement_assainissant_cuisson_temp)) {
        nextCarcasse.svi_ipm2_traitement_assainissant_cuisson_temp =
          body[Prisma.CarcasseScalarFieldEnum.svi_ipm2_traitement_assainissant_cuisson_temp];
      }
      if (
        body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_ipm2_traitement_assainissant_congelation_temps)
      ) {
        nextCarcasse.svi_ipm2_traitement_assainissant_congelation_temps =
          body[Prisma.CarcasseScalarFieldEnum.svi_ipm2_traitement_assainissant_congelation_temps];
      }
      if (
        body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_ipm2_traitement_assainissant_congelation_temp)
      ) {
        nextCarcasse.svi_ipm2_traitement_assainissant_congelation_temp =
          body[Prisma.CarcasseScalarFieldEnum.svi_ipm2_traitement_assainissant_congelation_temp];
      }
      if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_ipm2_traitement_assainissant_type)) {
        nextCarcasse.svi_ipm2_traitement_assainissant_type =
          body[Prisma.CarcasseScalarFieldEnum.svi_ipm2_traitement_assainissant_type];
      }
      if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_ipm2_traitement_assainissant_paramètres)) {
        nextCarcasse.svi_ipm2_traitement_assainissant_paramètres =
          body[Prisma.CarcasseScalarFieldEnum.svi_ipm2_traitement_assainissant_paramètres];
      }
      if (
        body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_ipm2_traitement_assainissant_etablissement)
      ) {
        nextCarcasse.svi_ipm2_traitement_assainissant_etablissement =
          body[Prisma.CarcasseScalarFieldEnum.svi_ipm2_traitement_assainissant_etablissement];
      }
      if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_ipm2_traitement_assainissant_poids)) {
        nextCarcasse.svi_ipm2_traitement_assainissant_poids =
          body[Prisma.CarcasseScalarFieldEnum.svi_ipm2_traitement_assainissant_poids];
      }
      if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_ipm2_poids_saisie)) {
        nextCarcasse.svi_ipm2_poids_saisie = body[Prisma.CarcasseScalarFieldEnum.svi_ipm2_poids_saisie];
      }
      if (body.hasOwnProperty(Prisma.CarcasseScalarFieldEnum.svi_ipm2_signed_at)) {
        nextCarcasse.svi_ipm2_signed_at = body[Prisma.CarcasseScalarFieldEnum.svi_ipm2_signed_at];
      }
    }

    console.log('nextCarcasse', nextCarcasse);
    console.log('nextCarcasse.svi_carcasse_status', nextCarcasse.svi_carcasse_status);

    const updatedCarcasse = await prisma.carcasse.update({
      where: {
        zacharie_carcasse_id: existingCarcasse.zacharie_carcasse_id,
      },
      data: nextCarcasse,
    });

    if (
      existingCarcasse.svi_ipm2_decision !== updatedCarcasse.svi_ipm2_decision &&
      (updatedCarcasse.svi_ipm2_decision === IPM2Decision.SAISIE_PARTIELLE ||
        updatedCarcasse.svi_ipm2_decision === IPM2Decision.SAISIE_TOTALE)
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

      const email = formatCarcasseChasseurEmail(updatedCarcasse);

      await sendNotificationToUser({
        user: examinateurInitial!,
        title: `Une carcasse de ${updatedCarcasse.espece} a été saisie`,
        body: email,
        email: email,
        notificationLogAction: `CARCASSE_SAISIE_${updatedCarcasse.zacharie_carcasse_id}`,
      });

      if (premierDetenteur?.id !== examinateurInitial?.id) {
        await sendNotificationToUser({
          user: premierDetenteur!,
          title: `Une carcasse de ${updatedCarcasse.espece} a été saisie`,
          body: email,
          email: email,
          notificationLogAction: `CARCASSE_SAISIE_${updatedCarcasse.zacharie_carcasse_id}`,
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

      const email = formatCarcasseChasseurEmail(updatedCarcasse);

      await sendNotificationToUser({
        user: examinateurInitial!,
        title: `Une carcasse de ${updatedCarcasse.espece} est manquante`,
        body: email,
        email: email,
        notificationLogAction: `CARCASSE_MANQUANTE_${updatedCarcasse.zacharie_carcasse_id}`,
      });

      if (premierDetenteur?.id !== examinateurInitial?.id) {
        await sendNotificationToUser({
          user: premierDetenteur!,
          title: `Une carcasse de ${updatedCarcasse.espece} est manquante`,
          body: email,
          email: email,
          notificationLogAction: `CARCASSE_MANQUANTE_${updatedCarcasse.zacharie_carcasse_id}`,
        });
      }
    }

    if (
      !existingCarcasse.intermediaire_carcasse_refus_intermediaire_id &&
      updatedCarcasse.intermediaire_carcasse_refus_intermediaire_id &&
      updatedCarcasse.intermediaire_carcasse_refus_motif
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

      const email = formatCarcasseChasseurEmail(updatedCarcasse);
      await sendNotificationToUser({
        user: examinateurInitial!,
        title: `Une carcasse de ${updatedCarcasse.espece} est refusée`,
        body: email,
        email: email,
        notificationLogAction: `CARCASSE_REFUS_${updatedCarcasse.zacharie_carcasse_id}`,
      });

      if (premierDetenteur?.id !== examinateurInitial?.id) {
        await sendNotificationToUser({
          user: premierDetenteur!,
          title: `Une carcasse de ${updatedCarcasse.espece} est refusée`,
          body: email,
          email: email,
          notificationLogAction: `CARCASSE_MANQUANTE_${updatedCarcasse.zacharie_carcasse_id}`,
        });
      }
    }

    checkGenerateCertificat(existingCarcasse, updatedCarcasse);

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
    const userIsSvi = req.user?.roles.includes(UserRoles.SVI);
    if (!userIsSvi) {
      res.status(403).send({ ok: false, data: null, error: 'Unauthorized' });
      return;
    }

    // Parse and validate query parameters
    const { page = '0', after, limit = '100', withDeleted = 'false' } = req.query as Record<string, string>;

    const parsedPage = Math.max(0, parseInt(page, 10) || 0);
    const parsedLimit = parseInt(limit, 10) || 10000;
    const includeDeleted = withDeleted === 'true';
    const afterDate = after && !isNaN(Number(after)) ? new Date(Number(after)) : null;

    // Base query conditions
    const where: Prisma.CarcasseWhereInput = {
      Fei: {
        svi_assigned_at: { not: null },
        deleted_at: null,
        FeiSviEntity: {
          EntityRelationsWithUsers: {
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
        carcasses: data.map((carcasse): CarcasseForResponseForRegistry => {
          const fei = carcasse.Fei;
          const toReturn = {} as CarcasseForResponseForRegistry;
          for (const key of Object.keys(carcasse)) {
            if (key === 'Fei') continue;
            // @ts-expect-error cannot guess fei_* fields
            toReturn[key] = carcasse[key];
          }
          toReturn.svi_carcasse_status = carcasse.svi_carcasse_status || updateCarcasseStatus(carcasse);
          toReturn.svi_carcasse_status_set_at =
            carcasse.svi_carcasse_status_set_at || fei.automatic_closed_at || fei.svi_closed_at;
          toReturn.svi_assigned_to_fei_at = carcasse.svi_assigned_to_fei_at || fei.svi_assigned_at;
          // svi_carcasse_archived = fei.automatic_closed_at || fei.svi_closed_at,
          toReturn.svi_carcasse_archived =
            !!fei.automatic_closed_at || dayjs(now).diff(fei.svi_assigned_at, 'day') > 10;
          for (const key of Object.keys(fei)) {
            // @ts-expect-error cannot guess fei_* fields
            toReturn[`fei_${key}`] = fei[key];
          }
          // console.log('svi_carcasse_status', toReturn.svi_carcasse_status, updateCarcasseStatus(carcasse));
          return toReturn as CarcasseForResponseForRegistry;
        }),
        hasMore: data.length === parsedLimit,
        total,
      },
      error: '',
    } satisfies CarcassesGetForRegistryResponse);
  }),
);

router.get(
  '/etg',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response) => {
    // Parse and validate query parameters
    const userIsEtg = req.user?.roles.includes(UserRoles.ETG);
    if (!userIsEtg) {
      res.status(403).send({ ok: false, data: null, error: 'Unauthorized' });
      return;
    }

    const { page = '0', after, limit = '100', withDeleted = 'false' } = req.query as Record<string, string>;

    const parsedPage = Math.max(0, parseInt(page, 10) || 0);
    const parsedLimit = parseInt(limit, 10) || 10000;
    const includeDeleted = withDeleted === 'true';
    const afterDate = after && !isNaN(Number(after)) ? new Date(Number(after)) : null;

    // Base query conditions
    const where: Prisma.CarcasseWhereInput = {
      Fei: {
        deleted_at: null,
        FeiIntermediaires: {
          some: {
            FeiIntermediaireEntity: {
              EntityRelationsWithUsers: {
                some: {
                  owner_id: req.user.id,
                  relation: EntityRelationType.WORKING_FOR,
                },
              },
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
        carcasses: data.map((carcasse): CarcasseForResponseForRegistry => {
          const fei = carcasse.Fei;
          const toReturn = {} as CarcasseForResponseForRegistry;
          for (const key of Object.keys(carcasse)) {
            if (key === 'Fei') continue;
            // @ts-expect-error cannot guess fei_* fields
            toReturn[key] = carcasse[key];
          }
          toReturn.svi_carcasse_status = carcasse.svi_carcasse_status || updateCarcasseStatus(carcasse);
          toReturn.svi_carcasse_status_set_at =
            carcasse.svi_carcasse_status_set_at || fei.automatic_closed_at || fei.svi_closed_at;
          toReturn.svi_assigned_to_fei_at = carcasse.svi_assigned_to_fei_at || fei.svi_assigned_at;
          // svi_carcasse_archived = fei.automatic_closed_at || fei.svi_closed_at,
          toReturn.svi_carcasse_archived =
            !!fei.automatic_closed_at || dayjs(now).diff(fei.svi_assigned_at, 'day') > 10;
          for (const key of Object.keys(fei)) {
            // @ts-expect-error cannot guess fei_* fields
            toReturn[`fei_${key}`] = fei[key];
          }
          // console.log('svi_carcasse_status', toReturn.svi_carcasse_status, updateCarcasseStatus(carcasse));
          return toReturn as CarcasseForResponseForRegistry;
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
