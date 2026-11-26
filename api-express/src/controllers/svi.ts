import express from 'express';
const router: express.Router = express.Router();
import passport from 'passport';
import { catchErrors } from '~/middlewares/errors';
import prisma from '~/prisma';
import { CarcasseType, UserRoles } from '@prisma/client';
import { RequestWithUser } from '~/types/request';
import type {
  BilanAnomaliesResponse,
  SviCarcassesAVenirResponse,
  SviTracabiliteAmontResponse,
} from '~/types/responses';
import { getBilanAnomalies } from '~/utils/bilan-anomalies';
import { carcassesAVenirChezEtgWhere, getEtgsLinkedToSviUser } from '~/utils/svi';

function countAnimaux(carcasse: { type: CarcasseType | null; nombre_d_animaux: number | null }): number {
  return carcasse.type === CarcasseType.PETIT_GIBIER ? (carcasse.nombre_d_animaux ?? 1) : 1;
}

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

    const carcasses = await prisma.carcasse.findMany({
      where: {
        deleted_at: null,
        ...carcassesAVenirChezEtgWhere(etgIds),
      },
      select: {
        zacharie_carcasse_id: true,
        numero_bracelet: true,
        fei_numero: true,
        espece: true,
        type: true,
        nombre_d_animaux: true,
        date_mise_a_mort: true,
        premier_detenteur_name_cache: true,
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
          numero_bracelet: carcasse.numero_bracelet,
          fei_numero: carcasse.fei_numero,
          premier_detenteur_name_cache: carcasse.premier_detenteur_name_cache,
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

router.get(
  '/tracabilite-amont',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response<SviTracabiliteAmontResponse>) => {
    if (!req.user.roles.includes(UserRoles.SVI)) {
      res.status(403).send({ ok: false, data: null, error: 'Accès réservé au SVI' });
      return;
    }

    const amont: SviTracabiliteAmontResponse['data']['amont'] = {
      nbFiches: 0,
      recuesEtg: 0,
      aVenir: 0,
      refuseesEtg: 0,
      manquantesEtg: 0,
      enAttente: 0,
    };

    const { etgIds } = await getEtgsLinkedToSviUser(req.user.id);

    if (etgIds.length === 0) {
      res.status(200).send({ ok: true, data: { amont }, error: '' });
      return;
    }

    const carcassesAVenir = await prisma.carcasse.findMany({
      where: {
        deleted_at: null,
        ...carcassesAVenirChezEtgWhere(etgIds),
      },
      select: { fei_numero: true, type: true, nombre_d_animaux: true },
    });
    for (const carcasse of carcassesAVenir) {
      amont.aVenir += countAnimaux(carcasse);
    }
    const feiNumeros = [...new Set(carcassesAVenir.map((c) => c.fei_numero))];
    amont.nbFiches = feiNumeros.length;

    if (feiNumeros.length === 0) {
      res.status(200).send({ ok: true, data: { amont }, error: '' });
      return;
    }

    const carcasses = await prisma.carcasse.findMany({
      where: {
        deleted_at: null,
        fei_numero: { in: feiNumeros },
        CarcasseIntermediaire: {
          some: { intermediaire_entity_id: { in: etgIds }, deleted_at: null },
        },
      },
      select: {
        type: true,
        nombre_d_animaux: true,
        intermediaire_carcasse_manquante: true,
        intermediaire_carcasse_refus_intermediaire_id: true,
      },
    });

    for (const carcasse of carcasses) {
      const animaux = countAnimaux(carcasse);
      amont.recuesEtg += animaux;

      if (carcasse.intermediaire_carcasse_manquante) {
        amont.manquantesEtg += animaux;
      } else if (carcasse.intermediaire_carcasse_refus_intermediaire_id) {
        amont.refuseesEtg += animaux;
      }
    }

    amont.enAttente = Math.max(0, amont.recuesEtg - amont.aVenir - amont.refuseesEtg - amont.manquantesEtg);

    res.status(200).send({ ok: true, data: { amont }, error: '' });
  })
);

router.get(
  '/bilan-anomalies',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response<BilanAnomaliesResponse>) => {
    if (!req.user.roles.includes(UserRoles.SVI)) {
      res.status(403).send({ ok: false, data: null, error: 'Accès réservé au SVI' });
      return;
    }
    const saison = Number(req.query.saison);
    if (!Number.isInteger(saison)) {
      res.status(400).send({ ok: false, data: null, error: 'Saison invalide' });
      return;
    }

    const { etgIds } = await getEtgsLinkedToSviUser(req.user.id);
    const bilan = await getBilanAnomalies(saison, etgIds);
    res.status(200).send({ ok: true, data: bilan, error: '' });
  })
);

export default router;
