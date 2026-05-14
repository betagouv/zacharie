import express from 'express';
import passport from 'passport';
import { catchErrors } from '~/middlewares/errors';
const router: express.Router = express.Router();
import prisma from '~/prisma';
import type { SearchResponse } from '~/types/responses';
import dayjs from 'dayjs';
import { RequestWithUser } from '~/types/request';
import { EntityRelationType, EntityRelationStatus, Prisma } from '@prisma/client';

router.get(
  '/',
  passport.authenticate('user', { session: false }),
  catchErrors(
    async (req: RequestWithUser, res: express.Response<SearchResponse>, next: express.NextFunction) => {
      const searchQuery = req.query.q as string;
      const user = req.user!;
      const userId = user.id;

      if (!searchQuery) {
        res.status(200).send({ ok: false, data: [], error: '' });
        return;
      }

      // Build FEI filter for ETG - FEIs that have carcasses handled by the ETG user's entity
      const feiWhereFilter: Prisma.FeiWhereInput = {
        deleted_at: null,
        CarcasseIntermediaire: {
          some: {
            CarcasseIntermediaireEntity: {
              EntityRelationsWithUsers: {
                some: {
                  owner_id: userId,
                  relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
                  status: {
                    in: [EntityRelationStatus.ADMIN, EntityRelationStatus.MEMBER],
                  },
                },
              },
            },
          },
        },
      };

      // Search by carcasse numero_bracelet
      const carcasses = await prisma.carcasse.findMany({
        where: {
          numero_bracelet: { contains: searchQuery },
          deleted_at: null,
          intermediaire_carcasse_refus_intermediaire_id: null,
          OR: [
            {
              intermediaire_carcasse_manquante: false,
            },
            {
              intermediaire_carcasse_manquante: null,
            },
          ],
          Fei: feiWhereFilter,
        },
        include: {
          Fei: {
            select: {
              numero: true,
              date_mise_a_mort: true,
              commune_mise_a_mort: true,
              svi_entity_id: true,
              svi_assigned_at: true,
            },
          },
        },
      });

      console.log('✌️ ~ carcasses?.length:', carcasses?.length);
      if (carcasses?.length) {
        res.status(200).send({
          ok: true,
          data: carcasses.map((carcasse) => ({
            searchQuery,
            redirectUrl: `/app/tableau-de-bord/fei/${carcasse.fei_numero}`,
            carcasse_numero_bracelet: carcasse.numero_bracelet,
            carcasse_espece: carcasse.espece || '',
            carcasse_type: carcasse.type,
            fei_numero: carcasse.fei_numero,
            fei_date_mise_a_mort: dayjs(carcasse.Fei.date_mise_a_mort).format('DD/MM/YYYY'),
            fei_svi_assigned_at: carcasse.Fei.svi_assigned_at
              ? dayjs(carcasse.Fei.svi_assigned_at).format('DD/MM/YYYY')
              : '',
            fei_commune_mise_a_mort: carcasse.Fei.commune_mise_a_mort!,
          })),
          error: '',
        });
        return;
      }

      // Search by carcasseIntermediaire commentaire and FEI info
      const carcasseIntermediaires = await prisma.carcasseIntermediaire.findMany({
        where: {
          OR: [
            {
              commentaire: {
                contains: searchQuery,
              },
            },
            {
              CarcasseIntermediaireFei: {
                OR: [
                  {
                    numero: {
                      contains: searchQuery,
                    },
                  },
                  {
                    commune_mise_a_mort: {
                      contains: searchQuery,
                    },
                  },
                ],
              },
            },
          ],
          CarcasseIntermediaireEntity: {
            EntityRelationsWithUsers: {
              some: {
                owner_id: userId,
                relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
                status: {
                  in: [EntityRelationStatus.ADMIN, EntityRelationStatus.MEMBER],
                },
              },
            },
          },
        },
        include: {
          CarcasseIntermediaireFei: {
            select: {
              numero: true,
              date_mise_a_mort: true,
              commune_mise_a_mort: true,
              svi_entity_id: true,
              svi_assigned_at: true,
            },
          },
        },
      });

      if (carcasseIntermediaires.length) {
        const foundCarcasses = [];
        for (const carcasseIntermediaire of carcasseIntermediaires) {
          const carcassesFound = await prisma.carcasse.findMany({
            where: {
              numero_bracelet: { contains: carcasseIntermediaire.numero_bracelet },
              Fei: feiWhereFilter,
            },
            include: {
              Fei: {
                select: {
                  numero: true,
                  date_mise_a_mort: true,
                  commune_mise_a_mort: true,
                  svi_entity_id: true,
                  svi_assigned_at: true,
                },
              },
            },
          });
          if (carcassesFound) {
            foundCarcasses.push(...carcassesFound);
          }
        }
        if (foundCarcasses.length) {
          res.status(200).send({
            ok: true,
            data: foundCarcasses.map((carcasse) => ({
              searchQuery,
              redirectUrl: `/app/tableau-de-bord/fei/${carcasse.fei_numero}`,
              carcasse_numero_bracelet: carcasse.numero_bracelet,
              carcasse_espece: carcasse.espece || '',
              carcasse_type: carcasse.type,
              fei_numero: carcasse.fei_numero,
              fei_date_mise_a_mort: dayjs(carcasse.Fei.date_mise_a_mort).format('DD/MM/YYYY'),
              fei_svi_assigned_at: carcasse.Fei.svi_assigned_at
                ? dayjs(carcasse.Fei.svi_assigned_at).format('DD/MM/YYYY')
                : '',
              fei_commune_mise_a_mort: carcasse.Fei.commune_mise_a_mort!,
            })),
            error: '',
          });
          return;
        }
      }

      // Search by FEI numero
      const feis = await prisma.fei.findMany({
        where: {
          numero: {
            contains: searchQuery,
          },
          ...feiWhereFilter,
        },
      });

      if (feis.length) {
        res.status(200).send({
          ok: true,
          data: feis.map((fei) => ({
            searchQuery,
            redirectUrl: `/app/tableau-de-bord/fei/${fei.numero}`,
            carcasse_numero_bracelet: '',
            carcasse_espece: '',
            carcasse_type: '',
            fei_numero: fei.numero,
            fei_date_mise_a_mort: dayjs(fei.date_mise_a_mort).format('DD/MM/YYYY'),
            fei_svi_assigned_at: fei.svi_assigned_at ? dayjs(fei.svi_assigned_at).format('DD/MM/YYYY') : '',
            fei_commune_mise_a_mort: fei.commune_mise_a_mort!,
          })),
          error: '',
        });
        return;
      }

      res.status(200).send({
        ok: true,
        data: [],
        error: 'Aucun élément ne correspond à votre recherche',
      });
      return;
    }
  )
);

export default router;
