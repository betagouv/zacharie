import express from 'express';
const router: express.Router = express.Router();
import passport from 'passport';
import { catchErrors } from '~/middlewares/errors';
import prisma from '~/prisma';
import { EntityRelationStatus, EntityRelationType, FeiOwnerRole, UserRoles } from '@prisma/client';
import { RequestWithUser } from '~/types/request';
import type { SviCarcassesAVenirResponse } from '~/types/responses';

// Volumétrie SVI : carcasses acceptées par un ETG rattaché au SVI mais pas encore transmises.
// Servi hors store local-first (le store SVI ne contient que les carcasses déjà transmises).
router.get(
  '/carcasses-a-venir',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response<SviCarcassesAVenirResponse>) => {
    if (!req.user.roles.includes(UserRoles.SVI)) {
      res.status(403).send({ ok: false, data: null, error: 'Accès réservé au SVI' });
      return;
    }

    // Entités SVI de l'utilisateur
    const sviEntityRelations = await prisma.entityAndUserRelations.findMany({
      where: {
        owner_id: req.user.id,
        relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
        status: { in: [EntityRelationStatus.ADMIN, EntityRelationStatus.MEMBER] },
      },
      select: { entity_id: true },
    });
    const sviEntityIds = sviEntityRelations.map((r) => r.entity_id);

    // ETG rattachés à ce SVI
    const etgs = await prisma.entity.findMany({
      where: {
        etg_linked_to_svi_id: { in: sviEntityIds },
        deleted_at: null,
      },
      select: { id: true, nom_d_usage: true, raison_sociale: true },
    });
    const etgIds = etgs.map((e) => e.id);
    const etgNameById = new Map(etgs.map((e) => [e.id, e.nom_d_usage || e.raison_sociale || 'ETG']));

    if (etgIds.length === 0) {
      res.status(200).send({ ok: true, data: { carcasses: [] }, error: '' });
      return;
    }

    // Carcasses actuellement chez l'ETG, acceptées (prise_en_charge sans refus/manquante),
    // pas encore transmises au SVI.
    const carcasses = await prisma.carcasse.findMany({
      where: {
        deleted_at: null,
        svi_assigned_at: null,
        current_owner_role: FeiOwnerRole.ETG,
        current_owner_entity_id: { in: etgIds },
        CarcasseIntermediaire: {
          some: {
            intermediaire_entity_id: { in: etgIds },
            prise_en_charge: true,
            refus: null,
            manquante: { not: true },
            deleted_at: null,
          },
        },
      },
      select: {
        zacharie_carcasse_id: true,
        fei_numero: true,
        espece: true,
        type: true,
        nombre_d_animaux: true,
        date_mise_a_mort: true,
        current_owner_entity_id: true,
        CarcasseIntermediaire: {
          where: { intermediaire_entity_id: { in: etgIds }, deleted_at: null },
          select: { prise_en_charge_at: true },
          orderBy: { prise_en_charge_at: 'desc' },
          take: 1,
        },
      },
    });

    res.status(200).send({
      ok: true,
      data: {
        carcasses: carcasses.map((carcasse) => ({
          zacharie_carcasse_id: carcasse.zacharie_carcasse_id,
          fei_numero: carcasse.fei_numero,
          espece: carcasse.espece,
          type: carcasse.type,
          nombre_d_animaux: carcasse.nombre_d_animaux,
          date_mise_a_mort: carcasse.date_mise_a_mort,
          etg_id: carcasse.current_owner_entity_id,
          etg_nom: carcasse.current_owner_entity_id
            ? (etgNameById.get(carcasse.current_owner_entity_id) ?? 'ETG')
            : 'ETG',
          arrived_at: carcasse.CarcasseIntermediaire[0]?.prise_en_charge_at ?? null,
        })),
      },
      error: '',
    });
  })
);

export default router;
