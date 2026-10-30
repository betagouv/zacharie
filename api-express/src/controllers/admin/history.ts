import express from 'express';
import { catchErrors } from '~/middlewares/errors';
import prisma from '~/prisma';
import { parseDateTimeRange, parseEnumList } from '~/utils/admin-list-filters';
import {
  HISTORY_SOURCES,
  loadHistoryPage,
  loadTimeline,
  type AdminHistoryTimelineType,
} from '~/utils/admin-history';
import type {
  AdminHistoryPageResponse,
  AdminHistorySubjectType,
  AdminHistoryTimelineResponse,
} from '~/types/admin-history';

const router: express.Router = express.Router();

const TIMELINE_TYPES: Array<AdminHistoryTimelineType> = ['fei', 'carcasse', 'user', 'entity'];
const SUBJECT_TYPES = Object.keys(HISTORY_SOURCES) as Array<AdminHistorySubjectType>;

// Page « Historique » : dernières modifications lues dans les tables d'historique, toutes tables confondues
router.get(
  '/history',
  catchErrors(async (req: express.Request, res: express.Response<AdminHistoryPageResponse>) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
    const offset = parseInt(req.query.offset as string) || 0;
    const types = parseEnumList(req.query.types, SUBJECT_TYPES);
    const authorEmail = typeof req.query.author_email === 'string' ? req.query.author_email.trim() : '';
    const subjectId = typeof req.query.subject_id === 'string' ? req.query.subject_id.trim() : '';
    const range = parseDateTimeRange(req.query.created_at_from, req.query.created_at_to);

    let authorId: string | null = null;
    if (authorEmail) {
      const author = await prisma.user.findUnique({
        where: { email: authorEmail.toLowerCase() },
        select: { id: true },
      });
      if (!author) {
        res.status(200).send({ ok: true, data: { events: [], total: 0 }, error: '' });
        return;
      }
      authorId = author.id;
    }

    const page = await loadHistoryPage(
      {
        types: types.length ? types : SUBJECT_TYPES,
        authorId,
        subjectId: subjectId || null,
        from: range?.gte ?? null,
        to: range?.lte ?? null,
      },
      limit,
      offset
    );
    res.status(200).send({ ok: true, data: page, error: '' });
  })
);

// Onglet « Historique » d'une fiche, d'une carcasse, d'un utilisateur ou d'une entité
router.get(
  '/history/:type/:id',
  catchErrors(async (req: express.Request, res: express.Response<AdminHistoryTimelineResponse>) => {
    const type = req.params.type as AdminHistoryTimelineType;
    if (!TIMELINE_TYPES.includes(type)) {
      res.status(400).send({ ok: false, data: null, error: 'Type inconnu' });
      return;
    }
    const timeline = await loadTimeline(type, req.params.id);
    res.status(200).send({ ok: true, data: timeline, error: '' });
  })
);

export default router;
