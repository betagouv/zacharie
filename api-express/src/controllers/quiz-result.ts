import express from 'express';
import { z } from 'zod';
import { catchErrors } from '~/middlewares/errors';
import { quizReadRateLimit, quizWriteRateLimit } from '~/middlewares/quiz-rate-limit';
import { cleanDisplayName } from '~/utils/clean-display-name';
import prisma from '~/prisma';

const router: express.Router = express.Router();

const answerSchema = z.object({
  questionId: z.string().min(1).max(20),
  givenAnswer: z.boolean(),
  correct: z.boolean(),
});

const createBodySchema = z.object({
  displayName: z.string().trim().min(1).max(30).optional(),
  score: z.number().int().min(0).max(50),
  totalQuestions: z.number().int().min(1).max(50),
  answers: z.array(answerSchema).max(50),
  durationSeconds: z.number().int().min(0).max(3600).optional(),
  source: z.enum(['tv', 'menu', 'direct']).optional(),
});

const patchBodySchema = z.object({
  displayName: z.string().trim().min(1).max(30),
});

const PATCH_NAME_WINDOW_MS = 10 * 60 * 1000;

router.post(
  '/',
  quizWriteRateLimit,
  catchErrors(async (req, res) => {
    const parsed = createBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).send({ ok: false, error: 'Données invalides', data: null });
      return;
    }
    const { displayName, score, totalQuestions, answers, durationSeconds, source } = parsed.data;

    let cleanedName: string | null = null;
    if (displayName) {
      const result = cleanDisplayName(displayName);
      if (result.ok === false) {
        res.status(400).send({
          ok: false,
          error: result.reason === 'forbidden' ? 'Pseudo non autorisé' : 'Pseudo invalide',
          data: null,
        });
        return;
      }
      cleanedName = result.value;
    }

    const quizResult = await prisma.quizResult.create({
      data: {
        display_name: cleanedName,
        score,
        total_questions: totalQuestions,
        answers,
        duration_seconds: durationSeconds,
        source,
      },
      select: { id: true },
    });

    res.status(201).send({ ok: true, data: { id: quizResult.id } });
  })
);

router.patch(
  '/:id/name',
  quizWriteRateLimit,
  catchErrors(async (req, res) => {
    const { id } = req.params;
    if (!id || typeof id !== 'string') {
      res.status(400).send({ ok: false, error: 'ID manquant', data: null });
      return;
    }

    const parsed = patchBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).send({ ok: false, error: 'Pseudo invalide', data: null });
      return;
    }

    const cleaned = cleanDisplayName(parsed.data.displayName);
    if (cleaned.ok === false) {
      res.status(400).send({
        ok: false,
        error: cleaned.reason === 'forbidden' ? 'Pseudo non autorisé' : 'Pseudo invalide',
        data: null,
      });
      return;
    }

    const existing = await prisma.quizResult.findUnique({
      where: { id },
      select: { id: true, created_at: true, deleted_at: true },
    });

    if (!existing || existing.deleted_at) {
      res.status(404).send({ ok: false, error: 'Résultat introuvable', data: null });
      return;
    }

    if (Date.now() - existing.created_at.getTime() > PATCH_NAME_WINDOW_MS) {
      res.status(403).send({ ok: false, error: 'Délai dépassé', data: null });
      return;
    }

    await prisma.quizResult.update({
      where: { id },
      data: { display_name: cleaned.value },
    });

    res.status(200).send({ ok: true, data: null });
  })
);

router.get(
  '/leaderboard',
  quizReadRateLimit,
  catchErrors(async (_req, res) => {
    const startOfDayParis = startOfTodayInParis();

    const top = await prisma.quizResult.findMany({
      where: {
        display_name: { not: null },
        deleted_at: null,
        created_at: { gte: startOfDayParis },
      },
      orderBy: [{ score: 'desc' }, { created_at: 'asc' }],
      take: 5,
      select: {
        display_name: true,
        score: true,
        total_questions: true,
        created_at: true,
      },
    });

    res.set('Cache-Control', 'public, max-age=15');
    res.status(200).send({ ok: true, data: { leaderboard: top } });
  })
);

function startOfTodayInParis(): Date {
  const formatter = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(new Date());
  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  // 00:00 in Paris during winter is 23:00 the day before in UTC (CET = UTC+1).
  // During DST it's 22:00 UTC. We compute the boundary by parsing midnight Paris time.
  const isoLocal = `${year}-${month}-${day}T00:00:00`;
  const tzOffsetMinutes = parisOffsetMinutes();
  const utcMs = Date.parse(isoLocal + 'Z') - tzOffsetMinutes * 60_000;
  return new Date(utcMs);
}

function parisOffsetMinutes(): number {
  const now = new Date();
  const utc = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
  const paris = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
  return (paris.getTime() - utc.getTime()) / 60_000;
}

export default router;
