import express from 'express';
import { EntityRelationStatus, EntityRelationType } from '@prisma/client';
import prisma from '~/prisma';
import { RequestWithUser } from '~/types/request';
import { getCarcasseAccess } from '~/utils/carcasse-access';

type Action = 'view' | 'edit' | 'delete';

function resolveCarcasseId(req: express.Request): string | null {
  const fromParams = req.params?.zacharie_carcasse_id;
  if (fromParams) return fromParams;
  const fromBody = (req.body as { zacharie_carcasse_id?: string } | undefined)?.zacharie_carcasse_id;
  if (fromBody) return fromBody;
  const feiNumero = req.params?.fei_numero;
  const numeroBracelet = req.params?.numero_bracelet;
  if (feiNumero && numeroBracelet) return `${feiNumero}_${numeroBracelet}`;
  return null;
}

export function checkCarcassePermission(action: Action) {
  return async (req: RequestWithUser, res: express.Response, next: express.NextFunction) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ ok: false, error: 'Authentication required', data: null });
      }
      if (!user.activated) {
        return res.status(400).json({ ok: false, error: "Le compte n'est pas activé", data: null });
      }

      const carcasseId = resolveCarcasseId(req);
      if (!carcasseId) {
        return res.status(400).json({ ok: false, error: 'Carcasse ID is missing', data: null });
      }

      const carcasse = await prisma.carcasse.findUnique({
        where: { zacharie_carcasse_id: carcasseId },
        include: { Fei: true },
      });
      if (!carcasse || !carcasse.Fei) {
        return res.status(404).json({ ok: false, error: 'Carcasse not found', data: null });
      }

      const relations = await prisma.entityAndUserRelations.findMany({
        where: {
          owner_id: user.id,
          relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
          status: { in: [EntityRelationStatus.ADMIN, EntityRelationStatus.MEMBER] },
        },
        select: { entity_id: true },
      });
      const userEntityIds = relations.map((r) => r.entity_id);

      const pastIntermediaire = await prisma.carcasseIntermediaire.findFirst({
        where: {
          zacharie_carcasse_id: carcasseId,
          deleted_at: null,
          OR: [
            { intermediaire_user_id: user.id },
            ...(userEntityIds.length ? [{ intermediaire_entity_id: { in: userEntityIds } }] : []),
          ],
        },
        select: { intermediaire_id: true },
      });
      const hasPastIntermediaireInvolvement = !!pastIntermediaire;

      const { Fei: fei, ...carcasseFields } = carcasse;
      const access = getCarcasseAccess({
        user,
        carcasse: carcasseFields,
        fei,
        userEntityIds,
        hasPastIntermediaireInvolvement,
      });

      let allowed = false;
      switch (action) {
        case 'view':
          allowed = access.canView;
          break;
        case 'edit':
          allowed = access.canEdit;
          break;
        case 'delete':
          allowed = access.canDelete;
          break;
      }

      if (!allowed) {
        return res.status(403).json({
          ok: false,
          error: `You don't have permission to ${action} this carcasse`,
          data: null,
        });
      }

      req.carcasse = carcasseFields;
      req.carcasseAccess = access;
      next();
    } catch (error) {
      console.error('Carcasse permission check error:', error);
      return res.status(500).json({ ok: false, error: 'Internal server error', data: null });
    }
  };
}
