import express from 'express';
import passport from 'passport';
import z from 'zod';
import { TrichineAliasObjet, TrichineStatutLogistiqueFTP, UserRoles } from '@prisma/client';
import prisma from '~/prisma';
import { catchErrors } from '~/middlewares/errors';
import type { RequestWithUser } from '~/types/request';
import { trichineEquipeUserIds } from '~/utils/trichine';
import {
  ALIAS_REFERENCE_CONFLIT,
  ALIAS_REFERENCE_INVALIDE,
  entiteSviPourObjet,
  aliasEntityIdsForUser,
  aliasEstFige,
  aliasSviEstFige,
  aliasReferenceDejaPrise,
  aliasReferenceSchema,
  deleteAlias,
  upsertAlias,
} from '~/utils/trichine-alias';

const router: express.Router = express.Router();

/**
 * Références internes (alias) des échantillons, pools et FTP, posées par le SVI émetteur et par
 * les laboratoires (LVD, LNR). Chacun ne peut écrire que l'alias de sa propre entité, sur un
 * objet qu'il voit déjà dans son espace.
 */

function sendError(res: express.Response, status: number, error: string) {
  res.status(status).send({ ok: false, data: null, error });
}

const objetParSegment = new Map<string, TrichineAliasObjet>([
  ['echantillon', TrichineAliasObjet.ECHANTILLON],
  ['pool', TrichineAliasObjet.POOL],
  ['ftp', TrichineAliasObjet.FTP],
]);

const FIGE_LABO = {
  [TrichineAliasObjet.ECHANTILLON]: 'Les analyses de cet échantillon sont terminées : sa référence est figée',
  [TrichineAliasObjet.POOL]: 'Les analyses de ce pool sont terminées : sa référence est figée',
  [TrichineAliasObjet.FTP]: 'Cette FTP est clôturée : sa référence est figée',
};

const FIGE_SVI = {
  [TrichineAliasObjet.ECHANTILLON]: 'Cet échantillon est parti au laboratoire : votre référence est figée',
  [TrichineAliasObjet.POOL]: 'Ce pool est parti au laboratoire : votre référence est figée',
  [TrichineAliasObjet.FTP]: 'Cette FTP est envoyée : votre référence est figée',
};

const liensFtp = {
  TrichinePoolFTPs: { include: { TrichineFTP: { select: { deleted_at: true, statut_logistique: true } } } },
} as const;

// FTP par laquelle un laboratoire voit un objet : envoyée (ou annulée après envoi), pas brouillon
function ftpVisibleParLabo(ftp: { deleted_at: Date | null; statut_logistique: TrichineStatutLogistiqueFTP }) {
  return !ftp.deleted_at && ftp.statut_logistique !== TrichineStatutLogistiqueFTP.BROUILLON;
}

// `fige` porte le motif du gel, null si la référence est encore modifiable
type Cible =
  | { kind: 'ok'; entityId: string; fige: string | null }
  | { kind: 'error'; status: number; error: string };

/**
 * Résout l'entité au nom de laquelle l'utilisateur pose l'alias, en vérifiant qu'il voit l'objet :
 * - SVI : l'objet a été prélevé / constitué / expédié par son équipe ;
 * - laboratoire : l'objet lui est arrivé par une FTP dont il est destinataire (ou expéditeur,
 *   pour la FTP de confirmation qu'un LVD envoie au LNR).
 */
async function resoudreCible(
  req: RequestWithUser,
  objetType: TrichineAliasObjet,
  objetId: string
): Promise<Cible> {
  const introuvable: Cible = { kind: 'error', status: 404, error: 'Objet introuvable' };
  if (!req.user.activated) {
    return { kind: 'error', status: 400, error: "Le compte n'est pas activé" };
  }
  const entityIds = await aliasEntityIdsForUser(req.user);
  if (!entityIds.length) {
    return { kind: 'error', status: 403, error: "Vous n'avez pas les droits pour effectuer cette action" };
  }

  if (req.user.roles.includes(UserRoles.SVI)) {
    const equipe = await trichineEquipeUserIds(req.user);
    if (objetType === TrichineAliasObjet.ECHANTILLON) {
      const echantillon = await prisma.trichineEchantillon.findUnique({
        where: { id: objetId },
        include: { TrichinePool: { include: liensFtp } },
      });
      if (!echantillon || echantillon.deleted_at || !equipe.includes(echantillon.preleve_par_user_id)) {
        return introuvable;
      }
      const ftps = echantillon.TrichinePool?.TrichinePoolFTPs.map((lien) => lien.TrichineFTP) ?? [];
      return {
        kind: 'ok',
        entityId: entiteSviPourObjet(entityIds, echantillon.preleve_par_entity_id),
        fige: aliasSviEstFige({ type: objetType, ftps }) ? FIGE_SVI[objetType] : null,
      };
    }
    if (objetType === TrichineAliasObjet.POOL) {
      const pool = await prisma.trichinePool.findUnique({ where: { id: objetId }, include: liensFtp });
      if (!pool || pool.deleted_at || !equipe.includes(pool.cree_par_user_id)) return introuvable;
      const ftps = pool.TrichinePoolFTPs.map((lien) => lien.TrichineFTP);
      return {
        kind: 'ok',
        entityId: entiteSviPourObjet(entityIds, pool.cree_par_entity_id),
        fige: aliasSviEstFige({ type: objetType, ftps }) ? FIGE_SVI[objetType] : null,
      };
    }
    const ftp = await prisma.trichineFTP.findUnique({ where: { id: objetId } });
    if (!ftp || ftp.deleted_at || !equipe.includes(ftp.expediteur_user_id)) return introuvable;
    return {
      kind: 'ok',
      entityId: entiteSviPourObjet(entityIds, ftp.expediteur_entity_id),
      fige: aliasSviEstFige({ type: objetType, ...ftp }) ? FIGE_SVI[objetType] : null,
    };
  }

  if (objetType === TrichineAliasObjet.FTP) {
    const ftp = await prisma.trichineFTP.findUnique({ where: { id: objetId } });
    if (!ftp || !ftpVisibleParLabo(ftp)) return introuvable;
    const entityId = [ftp.destinataire_entity_id, ftp.expediteur_entity_id].find(
      (id) => !!id && entityIds.includes(id)
    );
    if (!entityId) return introuvable;
    return {
      kind: 'ok',
      entityId,
      fige: aliasEstFige({ type: objetType, ...ftp }) ? FIGE_LABO[objetType] : null,
    };
  }

  const liensDuLabo = { include: { TrichineFTP: true } } as const;
  let poolId = objetId;
  let statut;
  if (objetType === TrichineAliasObjet.ECHANTILLON) {
    const echantillon = await prisma.trichineEchantillon.findUnique({ where: { id: objetId } });
    if (!echantillon || echantillon.deleted_at || !echantillon.pool_id) return introuvable;
    poolId = echantillon.pool_id;
    statut = echantillon.statut;
  }
  const pool = await prisma.trichinePool.findUnique({
    where: { id: poolId },
    include: { TrichinePoolFTPs: liensDuLabo },
  });
  if (!pool || pool.deleted_at) return introuvable;
  const entityId = pool.TrichinePoolFTPs.map(({ TrichineFTP: ftp }) => ftp).find(
    (ftp) => ftpVisibleParLabo(ftp) && entityIds.includes(ftp.destinataire_entity_id)
  )?.destinataire_entity_id;
  if (!entityId) return introuvable;
  return {
    kind: 'ok',
    entityId,
    fige: aliasEstFige({ type: objetType, statut: statut ?? pool.statut }) ? FIGE_LABO[objetType] : null,
  };
}

// Entités dont l'utilisateur porte l'alias : sert à distinguer « ma référence » des autres
router.get(
  '/mes-entites',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response) => {
    const entity_ids = await aliasEntityIdsForUser(req.user);
    res.status(200).send({ ok: true, data: { entity_ids }, error: '' });
  })
);

const aliasSchema = z.object({ reference: z.string() });

router.put(
  '/:objet/:objet_id',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response) => {
    const objetType = objetParSegment.get(req.params.objet);
    if (!objetType) return sendError(res, 404, 'Objet introuvable');
    const bodyResult = aliasSchema.safeParse(req.body);
    if (!bodyResult.success) return sendError(res, 400, 'Paramètres invalides');
    const referenceResult = aliasReferenceSchema.safeParse(bodyResult.data.reference);
    if (!referenceResult.success) return sendError(res, 400, ALIAS_REFERENCE_INVALIDE);
    const reference = referenceResult.data;

    const cible = await resoudreCible(req, objetType, req.params.objet_id);
    if (cible.kind === 'error') return sendError(res, cible.status, cible.error);
    if (cible.fige) return sendError(res, 400, cible.fige);

    const dejaPrise = await aliasReferenceDejaPrise({
      entityId: cible.entityId,
      objetType,
      objetId: req.params.objet_id,
      reference,
    });
    if (dejaPrise) return sendError(res, 400, dejaPrise);

    const outcome = await upsertAlias({
      entityId: cible.entityId,
      objetType,
      objetId: req.params.objet_id,
      reference,
    });
    if (outcome.kind === 'conflit') return sendError(res, 400, ALIAS_REFERENCE_CONFLIT);
    res.status(200).send({ ok: true, data: { alias: outcome.alias }, error: '' });
  })
);

router.delete(
  '/:objet/:objet_id',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response) => {
    const objetType = objetParSegment.get(req.params.objet);
    if (!objetType) return sendError(res, 404, 'Objet introuvable');
    const cible = await resoudreCible(req, objetType, req.params.objet_id);
    if (cible.kind === 'error') return sendError(res, cible.status, cible.error);
    if (cible.fige) return sendError(res, 400, cible.fige);

    await deleteAlias({ entityId: cible.entityId, objetType, objetId: req.params.objet_id });
    res.status(200).send({ ok: true, data: {}, error: '' });
  })
);

export default router;
