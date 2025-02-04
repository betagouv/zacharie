import express from 'express';
import passport from 'passport';
import { catchErrors } from '../middlewares/errors';
import type { FeiResponse, FeisResponse, FeisDoneResponse } from '~/types/responses';
const router: express.Router = express.Router();
import prisma from '~/prisma';
import dayjs from 'dayjs';
import { EntityRelationType, Prisma, User, UserRoles } from '@prisma/client';
import sendNotificationToUser from '~/service/notifications';
import { feiDoneSelect, feiPopulatedInclude } from '~/types/fei';
// import { refreshMaterializedViews } from '~/utils/refreshMaterializedViews';

router.post(
  '/:fei_numero',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const body: Prisma.FeiUncheckedCreateInput = req.body;
    const user = req.user;
    const feiNumero = req.params.fei_numero;
    if (!feiNumero) {
      res.status(400).send({
        ok: false,
        data: { fei: null },
        error: 'Le numéro de fiche est obligatoire',
      } satisfies FeiResponse);
      return;
    }
    let existingFei = await prisma.fei.findUnique({
      where: { numero: feiNumero },
      include: feiPopulatedInclude,
    });
    if (existingFei?.deleted_at) {
      res.status(200).send({
        ok: true,
        data: { fei: existingFei },
        error: '',
      } satisfies FeiResponse);
      return;
    }

    if (body.deleted_at) {
      if (!existingFei) {
        res.status(404).send({ ok: false, data: { fei: null }, error: 'Fei not found' });
        return;
      }
      const canDelete =
        user.roles.includes(UserRoles.ADMIN) ||
        (user.roles.includes(UserRoles.EXAMINATEUR_INITIAL) &&
          existingFei.fei_current_owner_user_id === user.id);
      if (!canDelete) {
        res.status(401).send({ ok: false, data: { fei: null }, error: 'Unauthorized' });
        return;
      }
      console.log('delete fei', feiNumero);
      const deletedFei = await prisma.fei.update({
        where: { numero: feiNumero },
        data: { deleted_at: body.deleted_at },
        include: feiPopulatedInclude,
      });
      await prisma.carcasse.updateMany({
        where: { fei_numero: feiNumero },
        data: { deleted_at: body.deleted_at },
      });
      await prisma.feiIntermediaire.updateMany({
        where: { fei_numero: feiNumero },
        data: { deleted_at: body.deleted_at },
      });
      await prisma.carcasseIntermediaire.updateMany({
        where: { fei_numero: feiNumero },
        data: { deleted_at: body.deleted_at },
      });
      res.status(200).send({
        ok: true,
        data: { fei: deletedFei },
        error: '',
      } satisfies FeiResponse);
      return;
    }

    if (!existingFei) {
      existingFei = await prisma.fei.create({
        data: {
          numero: feiNumero,
          created_by_user_id: user.id,
        },
        include: feiPopulatedInclude,
      });
    }

    const nextFei: Prisma.FeiUncheckedUpdateInput = {
      is_synced: true,
    };

    if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.date_mise_a_mort)) {
      nextFei.date_mise_a_mort = body.date_mise_a_mort || null;
    }
    if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.commune_mise_a_mort)) {
      nextFei.commune_mise_a_mort = body.commune_mise_a_mort || null;
    }
    if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.heure_mise_a_mort_premiere_carcasse)) {
      nextFei.heure_mise_a_mort_premiere_carcasse = body.heure_mise_a_mort_premiere_carcasse || null;
    }
    if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.heure_evisceration_derniere_carcasse)) {
      nextFei.heure_evisceration_derniere_carcasse = body.heure_evisceration_derniere_carcasse || null;
    }
    if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.created_by_user_id)) {
      nextFei.created_by_user_id = body.created_by_user_id;
    }
    if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.resume_nombre_de_carcasses)) {
      nextFei.resume_nombre_de_carcasses = body.resume_nombre_de_carcasses || null;
    }

    /*
      *
      *
      * *

      Examinateur initial

      */

    if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.examinateur_initial_user_id)) {
      nextFei.examinateur_initial_user_id = body.examinateur_initial_user_id || null;
    }
    if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.examinateur_initial_offline)) {
      nextFei.examinateur_initial_offline = body.examinateur_initial_offline || null;
    }
    if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.examinateur_initial_approbation_mise_sur_le_marche)) {
      nextFei.examinateur_initial_approbation_mise_sur_le_marche =
        body.examinateur_initial_approbation_mise_sur_le_marche || null;
    }
    if (
      body.hasOwnProperty(Prisma.FeiScalarFieldEnum.examinateur_initial_date_approbation_mise_sur_le_marche)
    ) {
      nextFei.examinateur_initial_date_approbation_mise_sur_le_marche =
        body.examinateur_initial_date_approbation_mise_sur_le_marche || null;
    }

    /*
      *
      *
      * *

      Premier détenteur

      */

    if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.premier_detenteur_user_id)) {
      nextFei.premier_detenteur_user_id = body.premier_detenteur_user_id || null;
    }
    if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.premier_detenteur_offline)) {
      nextFei.premier_detenteur_offline = body.premier_detenteur_offline || null;
    }
    if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.premier_detenteur_entity_id)) {
      nextFei.premier_detenteur_entity_id = body.premier_detenteur_entity_id || null;
    }
    if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.premier_detenteur_name_cache)) {
      nextFei.premier_detenteur_name_cache = body.premier_detenteur_name_cache || null;
    }
    if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.premier_detenteur_date_depot_quelque_part)) {
      nextFei.premier_detenteur_date_depot_quelque_part =
        body.premier_detenteur_date_depot_quelque_part || null;
    }
    if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.premier_detenteur_depot_entity_id)) {
      nextFei.premier_detenteur_depot_entity_id = body.premier_detenteur_depot_entity_id || null;
    }
    if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.premier_detenteur_depot_type)) {
      nextFei.premier_detenteur_depot_type = body.premier_detenteur_depot_type || null;
    }

    /*
  *
  *
  * *

  Responsabilités

  */
    /*  Current Owner */

    if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.fei_current_owner_user_id)) {
      nextFei.fei_current_owner_user_id = body.fei_current_owner_user_id || null;
    }
    if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.fei_current_owner_user_name_cache)) {
      nextFei.fei_current_owner_user_name_cache = body.fei_current_owner_user_name_cache || null;
    }
    if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.fei_current_owner_wants_to_transfer)) {
      nextFei.fei_current_owner_wants_to_transfer = body.fei_current_owner_wants_to_transfer || null;
    }
    if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.fei_current_owner_entity_id)) {
      nextFei.fei_current_owner_entity_id = body.fei_current_owner_entity_id || null;
    }
    if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.fei_current_owner_entity_name_cache)) {
      nextFei.fei_current_owner_entity_name_cache = body.fei_current_owner_entity_name_cache || null;
    }
    if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.fei_current_owner_role)) {
      nextFei.fei_current_owner_role = body.fei_current_owner_role || null;
    }
    /*  Next Owner */
    if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.fei_next_owner_user_id)) {
      nextFei.fei_next_owner_user_id = body.fei_next_owner_user_id || null;
    }
    if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.fei_next_owner_user_name_cache)) {
      nextFei.fei_next_owner_user_name_cache = body.fei_next_owner_user_name_cache || null;
    }
    if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.fei_next_owner_entity_id)) {
      nextFei.fei_next_owner_entity_id = body.fei_next_owner_entity_id || null;
      if (body.fei_next_owner_entity_id) {
        const nextRelation = {
          entity_id: body.fei_next_owner_entity_id,
          owner_id: user.id,
          relation: EntityRelationType.WORKING_WITH,
        };
        const existingRelation = await prisma.entityAndUserRelations.findFirst({
          where: nextRelation,
        });
        if (!existingRelation) {
          await prisma.entityAndUserRelations.create({ data: nextRelation });
        }
      }
    }
    if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.fei_next_owner_entity_name_cache)) {
      nextFei.fei_next_owner_entity_name_cache = body.fei_next_owner_entity_name_cache || null;
    }
    if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.fei_next_owner_role)) {
      nextFei.fei_next_owner_role = body.fei_next_owner_role || null;
    }
    /*  Prev Owner */
    if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.fei_prev_owner_user_id)) {
      nextFei.fei_prev_owner_user_id = body.fei_prev_owner_user_id || null;
    }
    if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.fei_prev_owner_entity_id)) {
      nextFei.fei_prev_owner_entity_id = body.fei_prev_owner_entity_id || null;
    }
    if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.fei_prev_owner_role)) {
      nextFei.fei_prev_owner_role = body.fei_prev_owner_role || null;
    }

    /*
  *
  *
  * *

  Intermédiaire

  */
    if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.intermediaire_closed_at)) {
      nextFei.intermediaire_closed_at = body.intermediaire_closed_at || null;
    }
    if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.intermediaire_closed_by_user_id)) {
      nextFei.intermediaire_closed_by_user_id = body.intermediaire_closed_by_user_id || null;
    }
    if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.intermediaire_closed_by_entity_id)) {
      nextFei.intermediaire_closed_by_entity_id = body.intermediaire_closed_by_entity_id || null;
    }

    /*
  *
  *
  * *

  SVI

  */
    if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.svi_signed_at)) {
      nextFei.svi_signed_at = body.svi_signed_at || null;
      if (body.svi_signed_at) nextFei.svi_signed_by = user.id;
    }
    if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.svi_assigned_at)) {
      nextFei.svi_assigned_at = body.svi_assigned_at || null;
    }
    if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.svi_entity_id)) {
      nextFei.svi_entity_id = body.svi_entity_id || null;
    }
    if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.svi_user_id)) {
      nextFei.svi_user_id = body.svi_user_id || null;
    }
    if (body.svi_carcasses_saisies) {
      nextFei.svi_carcasses_saisies = body.svi_carcasses_saisies || null;
    }
    if (body.svi_aucune_carcasse_saisie) {
      nextFei.svi_aucune_carcasse_saisie = body.svi_aucune_carcasse_saisie || null;
    }
    if (body.hasOwnProperty(Prisma.FeiScalarFieldEnum.svi_commentaire)) {
      nextFei.svi_commentaire = body.svi_commentaire || null;
    }

    const savedFei = await prisma.fei.update({
      where: { numero: feiNumero },
      data: nextFei,
      include: feiPopulatedInclude,
    });

    if (existingFei.fei_next_owner_role !== UserRoles.SVI && savedFei.fei_next_owner_role === UserRoles.SVI) {
      // this is the end of the fiche
      // send notification to examinateur initial
      const examinateurInitial = await prisma.user.findUnique({
        where: { id: savedFei.examinateur_initial_user_id! },
      });
      sendNotificationToUser({
        user: examinateurInitial!,
        title: `La fiche du ${dayjs(savedFei.date_mise_a_mort).format(
          'DD/MM/YYYY',
        )} est prise en charge par l'ETG`,
        body: `Les carcasses vont être inspectées par le Service Vétérinaire. Si une carcasse est saisie, vous serez notifié.`,
        email: `Les carcasses vont être inspectées par le Service Vétérinaire.\nSi une carcasse est saisie, vous serez notifié.\nSi aucune n'est saisie, vous serez notifié de la clôture automatique de la fiche au bout de 10 jours.`,
        notificationLogAction: `FEI_ASSIGNED_TO_${savedFei.fei_next_owner_role}_${savedFei.numero}`,
      });
      if (savedFei.examinateur_initial_user_id !== savedFei.premier_detenteur_user_id) {
        const premierDetenteur = await prisma.user.findUnique({
          where: { id: savedFei.premier_detenteur_user_id! },
        });
        sendNotificationToUser({
          user: premierDetenteur!,
          title: `La fiche du ${dayjs(savedFei.date_mise_a_mort).format(
            'DD/MM/YYYY',
          )} est prise en charge par l'ETG`,
          body: `Les carcasses vont être inspectées par le Service Vétérinaire. Si une carcasse est saisie, vous serez notifié.`,
          email: `Les carcasses vont être inspectées par le Service Vétérinaire.\nSi une carcasse est saisie, vous serez notifié.\nSi aucune n'est saisie, vous serez notifié de la clôture automatique de la fiche au bout de 10 jours.`,
          notificationLogAction: `FEI_ASSIGNED_TO_${savedFei.fei_next_owner_role}_${savedFei.numero}`,
        });
      }
      const sviUsers = await prisma.user.findMany({
        where: {
          roles: { has: UserRoles.SVI },
          EntityAndUserRelations: {
            some: {
              entity_id: savedFei.svi_entity_id!,
              relation: EntityRelationType.WORKING_FOR,
            },
          },
        },
      });
      for (const sviUser of sviUsers) {
        sendNotificationToUser({
          user: sviUser,
          title: `La fiche du ${dayjs(savedFei.date_mise_a_mort).format(
            'DD/MM/YYYY',
          )} est assignée à votre Service Vétérinaire d'Inspection`,
          body: `Vous avez une nouvelle fiche à traiter. Rendez-vous sur Zacharie pour la traiter.`,
          email: [
            `Carcasses à inspecter :\n${savedFei.resume_nombre_de_carcasses}`,
            `Rendez-vous sur Zacharie pour consulter le détail de la fiche\u00A0:\nhttps://zacharie.beta.gouv.fr/app/tableau-de-bord/fei/${savedFei.numero}`,
          ].join('\n'),
          notificationLogAction: `FEI_ASSIGNED_TO_${savedFei.fei_next_owner_role}_${savedFei.numero}`,
        });
      }
      res.status(200).send({
        ok: true,
        data: {
          fei: savedFei,
        },
        error: '',
      } satisfies FeiResponse);
      return;
    }

    if (body.fei_next_owner_user_id) {
      const nextOwnerId = body.fei_next_owner_user_id as string;
      if (nextOwnerId !== user.id) {
        console.log('need to send notification new fiche');
        const nextOwner = await prisma.user.findUnique({
          where: { id: nextOwnerId },
        });
        sendNotificationToUser({
          user: nextOwner!,
          title: 'Vous avez une nouvelle fiche à traiter',
          body: `${user.prenom} ${user.nom_de_famille} vous a attribué une nouvelle fiche.\nRendez vous sur Zacharie pour la traiter.`,
          email: `${user.prenom} ${user.nom_de_famille} vous a attribué une nouvelle fiche, la ${savedFei?.numero}.\nRendez vous sur Zacharie pour la traiter.`,
          notificationLogAction: `FEI_ASSIGNED_TO_${savedFei.fei_next_owner_role}_${savedFei.numero}`,
        });
        sendNotificationToUser({
          user: user,
          title: `${nextOwner!.prenom} ${nextOwner!.nom_de_famille} a été notifié`,
          body: `${nextOwner!.prenom} ${
            nextOwner!.nom_de_famille
          } a été notifié que vous lui avez attribué la fiche ${savedFei?.numero}.`,
          email: `${nextOwner!.prenom} ${
            nextOwner!.nom_de_famille
          } a été notifié que vous lui avez attribué la fiche ${savedFei?.numero}.`,
          notificationLogAction: `FEI_ASSIGNED_TO_${savedFei.fei_next_owner_role}_${savedFei.numero}_RECEIPT`,
        });
      } else if (existingFei.fei_next_owner_user_id && existingFei.fei_next_owner_user_id !== nextOwnerId) {
        console.log('need to send notification remove fiche');
        const exNextOwner = await prisma.user.findUnique({
          where: { id: existingFei.fei_next_owner_user_id },
        });
        sendNotificationToUser({
          user: exNextOwner!,
          title: 'Une fiche ne vous est plus attribuée',
          body: `${user.prenom} ${user.nom_de_famille} vous avait attribué une fiche, mais elle a finalement été attribuée à quelqu'un d'autre.`,
          email: `${user.prenom} ${user.nom_de_famille} vous avait attribué la fiche ${savedFei?.numero}, mais elle a finalement été attribuée à quelqu'un d'autre.`,
          notificationLogAction: `FEI_REMOVED_FROM_${savedFei.fei_next_owner_role}_${savedFei.numero}`,
        });
      } else {
        console.log('no need to send notification');
      }
    }

    if (body.fei_next_owner_entity_id) {
      const usersWorkingForEntity = (
        await prisma.entityAndUserRelations.findMany({
          where: {
            entity_id: body.fei_next_owner_entity_id as string,
            relation: EntityRelationType.WORKING_FOR,
          },
          include: {
            UserRelatedWithEntity: {
              select: {
                id: true,
                web_push_tokens: true,
                notifications: true,
                prenom: true,
                nom_de_famille: true,
                email: true,
              },
            },
          },
        })
      ).map((relation) => relation.UserRelatedWithEntity);
      for (const nextOwner of usersWorkingForEntity) {
        if (nextOwner.id !== user.id) {
          sendNotificationToUser({
            user: nextOwner as User,
            title: 'Vous avez une nouvelle fiche à traiter',
            body: `${user.prenom} ${user.nom_de_famille} vous a attribué une nouvelle fiche. Rendez vous sur Zacharie pour la traiter.`,
            email: `${user.prenom} ${user.nom_de_famille} vous a attribué une nouvelle fiche, la ${savedFei?.numero}.\nRendez vous sur Zacharie pour la traiter.`,
            notificationLogAction: `FEI_ASSIGNED_TO_${savedFei.fei_next_owner_role}_${savedFei.numero}`,
          });
        }
        if (existingFei.fei_next_owner_user_id && existingFei.fei_next_owner_user_id !== nextOwner.id) {
          const exNextOwner = await prisma.user.findUnique({
            where: { id: existingFei.fei_next_owner_user_id },
          });
          sendNotificationToUser({
            user: exNextOwner!,
            title: 'Une fiche ne vous est plus attribuée',
            body: `${user.prenom} ${user.nom_de_famille} vous avait attribué une fiche, mais elle a finalement été attribuée à quelqu'un d'autre.`,
            email: `${user.prenom} ${user.nom_de_famille} vous avait attribué la fiche ${savedFei?.numero}, mais elle a finalement été attribuée à quelqu'un d'autre.`,
            notificationLogAction: `FEI_REMOVED_FROM_${savedFei.fei_next_owner_role}_${savedFei.numero}`,
          });
        }
      }
    }

    // refreshMaterializedViews();

    res.status(200).send({
      ok: true,
      data: {
        fei: savedFei,
      },
      error: '',
    } satisfies FeiResponse);
  }),
);

router.get(
  '/done',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = req.user!;
    // if (!user.onboarded_at) {
    //   res.status(200).send({
    //     ok: true,
    //     data: {
    //       user: null,
    //       feisDone: [],
    //     },
    //     error: '',
    //   });
    //   return;
    // }

    const feisDone = await prisma.fei.findMany({
      where: {
        deleted_at: null,
        AND: [
          {
            OR: [{ svi_assigned_at: { not: null } }, { intermediaire_closed_at: { not: null } }],
          },
          {
            OR: [
              { examinateur_initial_user_id: user.id },
              { premier_detenteur_user_id: user.id },
              {
                FeiPremierDetenteurEntity: {
                  EntityRelationsWithUsers: {
                    some: {
                      owner_id: user.id,
                      relation: EntityRelationType.WORKING_FOR,
                    },
                  },
                },
              },
              { svi_user_id: user.id },
              {
                FeiIntermediaires: {
                  some: {
                    fei_intermediaire_user_id: user.id,
                  },
                },
              },
              {
                FeiIntermediaires: {
                  some: {
                    FeiIntermediaireEntity: {
                      EntityRelationsWithUsers: {
                        some: {
                          owner_id: user.id,
                          relation: EntityRelationType.WORKING_FOR,
                        },
                      },
                    },
                  },
                },
              },
              {
                FeiIntermediaires: {
                  some: {
                    FeiIntermediaireEntity: {
                      RelationsWithEtgs: {
                        some: {
                          ETGRelatedWithEntity: {
                            EntityRelationsWithUsers: {
                              some: {
                                owner_id: user.id,
                                relation: EntityRelationType.WORKING_FOR,
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
              {
                FeiSviEntity: {
                  EntityRelationsWithUsers: {
                    some: {
                      owner_id: user.id,
                      relation: EntityRelationType.WORKING_FOR,
                    },
                  },
                },
              },
            ],
          },
        ],
      },
      select: feiDoneSelect,
      orderBy: {
        svi_assigned_at: 'desc',
      },
    });

    res.status(200).send({
      ok: true,
      data: {
        user,
        feisDone,
      },
      error: '',
    } satisfies FeisDoneResponse);
    return;
  }),
);

router.get(
  '/:fei_numero',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const now = Date.now();
    const fei = await prisma.fei.findUnique({
      where: {
        numero: req.params.fei_numero,
      },
      include: {
        Carcasses: {
          include: {
            CarcasseIntermediaire: true,
          },
        },
        FeiExaminateurInitialUser: true,
        FeiPremierDetenteurUser: true,
        FeiPremierDetenteurEntity: true,
        FeiDepotEntity: true,
        FeiCurrentUser: true,
        FeiCurrentEntity: true,
        FeiNextUser: true,
        FeiNextEntity: true,
        FeiSviUser: true,
        FeiSviEntity: true,
        FeiIntermediaires: {
          include: {
            FeiIntermediaireUser: true,
            FeiIntermediaireEntity: true,
            FeiIntermediairesCarcasses: true,
            CarcasseIntermediaire: true,
          },
          orderBy: {
            created_at: 'desc',
          },
        },
      },
    });

    if (!fei) {
      res.status(404).send({ ok: false, data: null, error: 'Unauthorized' });
      return;
    }

    res.status(200).send({
      ok: true,
      data: {
        fei,
      },
      error: '',
    } satisfies FeiResponse);
  }),
);

router.get(
  '/',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = req.user!;
    // if (!user?.onboarded_at) {
    //   res.status(200).send({
    //     ok: true,
    //     data: {
    //       user: null,
    //       feisUnderMyResponsability: [],
    //       feisToTake: [],
    //       feisOngoing: [],
    //       feisDone: [],
    //     },
    //     error: 'Not onboarded',
    //   });
    //   return;
    // }
    const feisUnderMyResponsability = await prisma.fei.findMany({
      where: {
        deleted_at: null,
        automatic_closed_at: null,
        svi_signed_at: null,
        fei_next_owner_user_id: null,
        fei_next_owner_entity_id: null,
        svi_assigned_at: null,
        intermediaire_closed_at: null,
        OR: [
          {
            fei_current_owner_user_id: user.id,
          },
          {
            FeiCurrentEntity: {
              EntityRelationsWithUsers: {
                some: {
                  owner_id: user.id,
                  relation: EntityRelationType.WORKING_FOR,
                },
              },
            },
          },
          {
            AND: [
              {
                fei_current_owner_role: UserRoles.ETG,
              },
              {
                FeiCurrentEntity: {
                  AsEtgRelationsWithOtherEntities: {
                    some: {
                      EntityRelatedWithETG: {
                        EntityRelationsWithUsers: {
                          some: {
                            owner_id: user.id,
                            relation: EntityRelationType.WORKING_FOR,
                          },
                        },
                      },
                    },
                  },
                },
              },
            ],
          },
          {
            AND: [
              {
                fei_next_owner_role: UserRoles.COLLECTEUR_PRO,
              },
              {
                FeiNextEntity: {
                  RelationsWithEtgs: {
                    some: {
                      ETGRelatedWithEntity: {
                        EntityRelationsWithUsers: {
                          some: {
                            owner_id: user.id,
                            relation: EntityRelationType.WORKING_FOR,
                          },
                        },
                      },
                    },
                  },
                },
              },
            ],
          },
        ],
      },
      include: {
        FeiIntermediaires: {
          include: {
            FeiIntermediairesCarcasses: true,
          },
        },
      },
      orderBy: {
        updated_at: 'desc',
      },
    });

    const feisToTake = await prisma.fei.findMany({
      where: {
        deleted_at: null,
        numero: { notIn: feisUnderMyResponsability.map((fei) => fei.numero) },
        svi_assigned_at: null,
        intermediaire_closed_at: null,
        OR: [
          {
            fei_next_owner_user_id: user.id,
          },
          {
            FeiNextEntity: {
              EntityRelationsWithUsers: {
                some: {
                  owner_id: user.id,
                  relation: EntityRelationType.WORKING_FOR,
                },
              },
            },
          },
          {
            AND: [
              {
                fei_next_owner_role: UserRoles.ETG,
              },
              {
                FeiNextEntity: {
                  RelationsWithEtgs: {
                    some: {
                      EntityRelatedWithETG: {
                        EntityRelationsWithUsers: {
                          some: {
                            owner_id: user.id,
                            relation: EntityRelationType.WORKING_FOR,
                          },
                        },
                      },
                    },
                  },
                },
              },
            ],
          },
        ],
      },
      include: {
        FeiIntermediaires: {
          include: {
            FeiIntermediairesCarcasses: true,
          },
        },
      },
      orderBy: {
        updated_at: 'desc',
      },
    });

    const feisOngoing = await prisma.fei.findMany({
      where: {
        deleted_at: null,
        svi_assigned_at: null,
        intermediaire_closed_at: null,
        numero: {
          notIn: [
            ...feisUnderMyResponsability.map((fei) => fei.numero),
            ...feisToTake.map((fei) => fei.numero),
          ],
        },
        // fei_current_owner_user_id: { not: user.id },
        AND: [
          // {
          //   AND: [
          //     {
          //       fei_next_owner_user_id: { not: user.id },
          //     },
          //     // {
          //     //   fei_next_owner_user_id: { not: null },
          //     // },
          //   ],
          // },
          // {
          //   OR: [
          //     { fei_next_owner_entity_id: null },
          //     {
          //       FeiNextEntity: {
          //         EntityRelationsWithUsers: {
          //           none: {
          //             owner_id: user.id,
          //             relation: EntityRelationType.WORKING_FOR,
          //           },
          //         },
          //       },
          //     },
          //   ],
          // },
          {
            OR: [
              {
                examinateur_initial_user_id: user.id,
              },
              {
                premier_detenteur_user_id: user.id,
              },
              {
                FeiPremierDetenteurEntity: {
                  EntityRelationsWithUsers: {
                    some: {
                      owner_id: user.id,
                      relation: EntityRelationType.WORKING_FOR,
                    },
                  },
                },
              },
              {
                FeiIntermediaires: {
                  some: {
                    fei_intermediaire_user_id: user.id,
                  },
                },
              },
              {
                FeiIntermediaires: {
                  some: {
                    FeiIntermediaireEntity: {
                      EntityRelationsWithUsers: {
                        some: {
                          owner_id: user.id,
                          relation: EntityRelationType.WORKING_FOR,
                        },
                      },
                    },
                  },
                },
              },
              {
                FeiIntermediaires: {
                  some: {
                    FeiIntermediaireEntity: {
                      RelationsWithEtgs: {
                        some: {
                          ETGRelatedWithEntity: {
                            EntityRelationsWithUsers: {
                              some: {
                                owner_id: user.id,
                                relation: EntityRelationType.WORKING_FOR,
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            ],
          },
        ],
      },
      include: {
        FeiIntermediaires: {
          include: {
            FeiIntermediairesCarcasses: true,
          },
        },
      },
      orderBy: {
        updated_at: 'desc',
      },
    });

    // console.log("feisUnderMyResponsability", feisUnderMyResponsability.length);
    // console.log("feisToTake", feisToTake.length);
    // console.log("feisOngoing", feisOngoing.length);

    res.status(200).send({
      ok: true,
      data: {
        user,
        feisUnderMyResponsability,
        feisToTake,
        feisOngoing,
      },
      error: '',
    } satisfies FeisResponse);
  }),
);

export default router;
