import express from 'express';
const router: express.Router = express.Router();
import passport from 'passport';
import { catchErrors } from '~/middlewares/errors';
import prisma from '~/prisma';
import {
  CarcasseType,
  EntityRelationStatus,
  EntityRelationType,
  FeiOwnerRole,
  UserRoles,
} from '@prisma/client';
import { RequestWithUser } from '~/types/request';
import type { SviCarcassesAVenirResponse, SviTracabiliteAmontResponse } from '~/types/responses';

// ETG rattachés au(x) SVI de l'utilisateur, avec un libellé d'affichage par ETG.
async function getEtgsLinkedToSviUser(userId: string) {
  const sviEntityRelations = await prisma.entityAndUserRelations.findMany({
    where: {
      owner_id: userId,
      relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
      status: { in: [EntityRelationStatus.ADMIN, EntityRelationStatus.MEMBER] },
    },
    select: { entity_id: true },
  });
  const sviEntityIds = sviEntityRelations.map((r) => r.entity_id);

  const etgs = await prisma.entity.findMany({
    where: {
      etg_linked_to_svi_id: { in: sviEntityIds },
      deleted_at: null,
    },
    select: { id: true, nom_d_usage: true, raison_sociale: true },
  });
  const etgIds = etgs.map((e) => e.id);
  const etgNameById = new Map(etgs.map((e) => [e.id, e.nom_d_usage || e.raison_sociale || 'ETG']));
  return { etgIds, etgNameById };
}

// Nombre d'animaux comptés par carcasse, comme ailleurs dans l'app :
// petit gibier = un lot de plusieurs animaux, grand gibier = 1 carcasse = 1 animal.
function countAnimaux(carcasse: { type: CarcasseType | null; nombre_d_animaux: number | null }): number {
  return carcasse.type === CarcasseType.PETIT_GIBIER ? (carcasse.nombre_d_animaux ?? 1) : 1;
}

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

    const { etgIds, etgNameById } = await getEtgsLinkedToSviUser(req.user.id);

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

// Traçabilité amont : écart entre les carcasses reçues par les ETG rattachés au SVI
// et celles réellement présentées à l'inspection (refus ETG + manquantes expliquent l'écart).
// Volumes en nombre d'animaux, tout l'historique.
router.get(
  '/tracabilite-amont',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response<SviTracabiliteAmontResponse>) => {
    if (!req.user.roles.includes(UserRoles.SVI)) {
      res.status(403).send({ ok: false, data: null, error: 'Accès réservé au SVI' });
      return;
    }

    const amont: SviTracabiliteAmontResponse['data']['amont'] = {
      recuesEtg: 0,
      refuseesEtg: 0,
      manquantesEtg: 0,
      enAttenteTransmission: 0,
      presenteesSvi: 0,
      manquantesSvi: 0,
    };

    const { etgIds } = await getEtgsLinkedToSviUser(req.user.id);

    if (etgIds.length === 0) {
      res.status(200).send({ ok: true, data: { amont }, error: '' });
      return;
    }

    // Toutes les carcasses passées par un ETG rattaché au SVI (dénominateur = reçues par vos ETG).
    const carcasses = await prisma.carcasse.findMany({
      where: {
        deleted_at: null,
        CarcasseIntermediaire: {
          some: { intermediaire_entity_id: { in: etgIds }, deleted_at: null },
        },
      },
      select: {
        type: true,
        nombre_d_animaux: true,
        intermediaire_carcasse_manquante: true,
        intermediaire_carcasse_refus_intermediaire_id: true,
        svi_assigned_at: true,
        svi_ipm1_presentee_inspection: true,
        svi_ipm2_presentee_inspection: true,
      },
    });

    for (const carcasse of carcasses) {
      const animaux = countAnimaux(carcasse);
      amont.recuesEtg += animaux;

      // Ordre important : manquante avant refus (le champ _refus_intermediaire_id est aussi
      // posé pour une manquante), comme dans updateCarcasseStatus.
      if (carcasse.intermediaire_carcasse_manquante) {
        amont.manquantesEtg += animaux;
      } else if (carcasse.intermediaire_carcasse_refus_intermediaire_id) {
        amont.refuseesEtg += animaux;
      } else if (!carcasse.svi_assigned_at) {
        amont.enAttenteTransmission += animaux;
      } else if (carcasse.svi_ipm1_presentee_inspection || carcasse.svi_ipm2_presentee_inspection) {
        amont.presenteesSvi += animaux;
      } else {
        amont.manquantesSvi += animaux;
      }
    }

    res.status(200).send({ ok: true, data: { amont }, error: '' });
  })
);

export default router;
