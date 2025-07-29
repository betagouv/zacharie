import express from 'express';
import passport from 'passport';
import { catchErrors } from '~/middlewares/errors.ts';
import type { FeiResponse, FeisResponse, FeisDoneResponse } from '~/types/responses';
const router: express.Router = express.Router();
import prisma from '~/prisma';
import { EntityRelationType, Prisma, UserRoles } from '@prisma/client';

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
        CarcasseIntermediaire: {
          include: {
            CarcasseIntermediaireEntity: true,
            CarcasseIntermediaireUser: true,
          },
          orderBy: [{ prise_en_charge_at: Prisma.SortOrder.asc }, { created_at: Prisma.SortOrder.desc }],
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
        // deleted_at: null,
        automatic_closed_at: null,
        svi_closed_at: null,
        fei_next_owner_user_id: null,
        fei_next_owner_entity_id: null,
        svi_assigned_at: null,
        intermediaire_closed_at: null,
        OR: [
          // Case 1: I am the current owner of the FEI
          {
            fei_current_owner_user_id: user.id,
          },
          // Case 2: I work for the current owner entity.
          {
            FeiCurrentEntity: {
              EntityRelationsWithUsers: {
                some: {
                  owner_id: user.id,
                  relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
                },
              },
            },
          },
          // Case 3: The FEI is assigned to a COLLECTEUR_PRO working for my ETG
          {
            AND: [
              {
                fei_current_owner_role: UserRoles.COLLECTEUR_PRO,
              },
              {
                FeiNextEntity: {
                  RelationsWithEtgs: {
                    some: {
                      ETGRelatedWithEntity: {
                        EntityRelationsWithUsers: {
                          some: {
                            owner_id: user.id,
                            relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
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
        CarcasseIntermediaire: true,
      },
      orderBy: {
        updated_at: 'desc',
      },
    });

    const feisToTake = await prisma.fei.findMany({
      where: {
        // deleted_at: null,
        numero: { notIn: feisUnderMyResponsability.map((fei) => fei.numero) },
        svi_assigned_at: null,
        intermediaire_closed_at: null,
        OR: [
          // If the user is directly set as the next owner
          { fei_next_owner_user_id: user.id },
          // Or if the user works for the next owner entity directly (for non-ETG next owners)
          {
            FeiNextEntity: {
              EntityRelationsWithUsers: {
                some: {
                  owner_id: user.id,
                  relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
                },
              },
            },
          },
          // Or if the next owner is an ETG and the current user works for a collecteur
          // linked to that ETG (via the ETG relations), then include the FEI.
          {
            AND: [
              { fei_next_owner_role: UserRoles.ETG },
              {
                FeiNextEntity: {
                  AsEtgRelationsWithOtherEntities: {
                    some: {
                      EntityRelatedWithETG: {
                        EntityRelationsWithUsers: {
                          some: {
                            owner_id: user.id,
                            relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
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
        CarcasseIntermediaire: true,
      },
      orderBy: {
        updated_at: 'desc',
      },
    });

    const feisOngoing = await prisma.fei.findMany({
      where: {
        // deleted_at: null,
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
          //             relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
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
              ...(user.roles.includes(UserRoles.PREMIER_DETENTEUR)
                ? [
                    {
                      premier_detenteur_user_id: user.id,
                    },
                    {
                      FeiPremierDetenteurEntity: {
                        EntityRelationsWithUsers: {
                          some: {
                            owner_id: user.id,
                            relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
                          },
                        },
                      },
                    },
                  ]
                : []),
              {
                CarcasseIntermediaire: {
                  some: {
                    intermediaire_user_id: user.id,
                  },
                },
              },
              {
                CarcasseIntermediaire: {
                  some: {
                    CarcasseIntermediaireEntity: {
                      EntityRelationsWithUsers: {
                        some: {
                          owner_id: user.id,
                          relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
                        },
                      },
                    },
                  },
                },
              },
              {
                CarcasseIntermediaire: {
                  some: {
                    CarcasseIntermediaireEntity: {
                      RelationsWithEtgs: {
                        some: {
                          ETGRelatedWithEntity: {
                            EntityRelationsWithUsers: {
                              some: {
                                owner_id: user.id,
                                relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
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
        CarcasseIntermediaire: true,
      },
      orderBy: {
        updated_at: 'desc',
      },
    });

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
