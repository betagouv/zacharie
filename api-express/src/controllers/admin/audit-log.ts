import express from 'express';
import { Prisma } from '@prisma/client';
import { catchErrors } from '~/middlewares/errors';
import prisma from '~/prisma';
import { parseDateTimeRange, parseList } from '~/utils/admin-list-filters';
import type { AdminAuditLogResponse } from '~/types/responses';

const router: express.Router = express.Router();

// Journal des écritures faites depuis /admin (voir middlewares/admin-audit-log.ts)
router.get(
  '/audit-log',
  catchErrors(async (req: express.Request, res: express.Response<AdminAuditLogResponse>) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
    const offset = parseInt(req.query.offset as string) || 0;
    const adminIds = parseList(req.query.admin_user_ids);
    const targetTypes = parseList(req.query.target_types);
    const actions = parseList(req.query.actions);
    const targetId = typeof req.query.target_id === 'string' ? req.query.target_id.trim() : '';
    const createdAt = parseDateTimeRange(req.query.created_at_from, req.query.created_at_to);

    const and: Array<Prisma.AdminAuditLogWhereInput> = [];
    if (adminIds.length) and.push({ admin_user_id: { in: adminIds } });
    if (targetTypes.length) and.push({ target_type: { in: targetTypes } });
    if (actions.length) and.push({ action: { in: actions } });
    if (targetId) and.push({ target_id: targetId });
    if (createdAt) and.push({ created_at: createdAt });
    const where: Prisma.AdminAuditLogWhereInput = and.length ? { AND: and } : {};

    const [logs, total, admins, actionRows] = await Promise.all([
      prisma.adminAuditLog.findMany({ where, orderBy: { created_at: 'desc' }, take: limit, skip: offset }),
      prisma.adminAuditLog.count({ where }),
      prisma.user.findMany({
        where: { isZacharieAdmin: true },
        select: { id: true, email: true },
        orderBy: { email: 'asc' },
      }),
      prisma.adminAuditLog.findMany({
        distinct: ['action'],
        select: { action: true },
        orderBy: { action: 'asc' },
      }),
    ]);

    // Libellés lisibles des admins et des cibles, résolus en une requête par type
    const idsOf = (type: string) =>
      logs.filter((log) => log.target_type === type).map((log) => log.target_id!);
    const [users, entities, carcasses] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: [...new Set([...logs.map((log) => log.admin_user_id), ...idsOf('user')])] } },
        select: { id: true, email: true },
      }),
      prisma.entity.findMany({
        where: { id: { in: idsOf('entity') } },
        select: { id: true, nom_d_usage: true },
      }),
      prisma.carcasse.findMany({
        where: { zacharie_carcasse_id: { in: idsOf('carcasse') } },
        select: { zacharie_carcasse_id: true, numero_bracelet: true },
      }),
    ]);
    const emailById = new Map(users.map((user) => [user.id, user.email]));
    const labelByTarget = new Map<string, string | null>([
      ...users.map((user) => [`user:${user.id}`, user.email] as const),
      ...entities.map((entity) => [`entity:${entity.id}`, entity.nom_d_usage] as const),
      ...carcasses.map(
        (carcasse) => [`carcasse:${carcasse.zacharie_carcasse_id}`, carcasse.numero_bracelet] as const
      ),
    ]);

    res.status(200).send({
      ok: true,
      data: {
        logs: logs.map((log) => ({
          ...log,
          admin_email: emailById.get(log.admin_user_id) ?? null,
          target_label:
            labelByTarget.get(`${log.target_type}:${log.target_id}`) ??
            (log.target_type === 'fei' ? log.target_id : null),
        })),
        total,
        admins,
        actions: actionRows.map((row) => row.action),
      },
      error: '',
    });
  })
);

export default router;
