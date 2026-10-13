import express from 'express';
import dayjs from 'dayjs';
import { BugInvestigationStatus, Prisma, type User } from '@prisma/client';
import { catchErrors } from '~/middlewares/errors';
import prisma from '~/prisma';
import { capture } from '~/third-parties/sentry';
import { runBugInvestigation } from '~/service/bug-investigator';
import type { AlbertUserMessage, BugInvestigationMessage } from '~/types/bug-investigation';
import type {
  AdminBugInvestigationResponse,
  AdminBugInvestigationsResponse,
  AdminNewBugInvestigationResponse,
} from '~/types/responses';

const router: express.Router = express.Router();

const MAX_IMAGES = 5;

// L'enquête tourne dans le process de l'API : si le serveur redémarre, elle resterait "en cours"
async function markInterruptedInvestigations() {
  await prisma.bugInvestigation.updateMany({
    where: {
      status: BugInvestigationStatus.EN_COURS,
      updated_at: { lt: dayjs().subtract(20, 'minute').toDate() },
    },
    data: { status: BugInvestigationStatus.ERREUR, error: 'Enquête interrompue (redémarrage du serveur ?)' },
  });
}

function buildUserMessage(body: {
  content?: unknown;
  images?: unknown;
}): { message: AlbertUserMessage; text: string; error: null } | { message: null; text: null; error: string } {
  const text = typeof body.content === 'string' ? body.content.trim() : '';
  const images: Array<unknown> = Array.isArray(body.images) ? body.images : [];
  if (!text && !images.length) {
    return { message: null, text: null, error: 'Écrivez un message ou joignez une capture' };
  }
  if (
    images.length > MAX_IMAGES ||
    images.some((image) => typeof image !== 'string' || !image.startsWith('data:image/'))
  ) {
    return { message: null, text: null, error: `${MAX_IMAGES} images au maximum` };
  }
  const message: AlbertUserMessage = {
    role: 'user',
    content: [
      ...(text ? [{ type: 'text' as const, text }] : []),
      ...(images as Array<string>).map((url) => ({ type: 'image_url' as const, image_url: { url } })),
    ],
  };
  return { message, text, error: null };
}

function startInvestigation(id: string) {
  runBugInvestigation(id).catch((error) => capture(error, { extra: { bugInvestigationId: id } }));
}

router.get(
  '/bug-resolutions',
  catchErrors(async (_req: express.Request, res: express.Response<AdminBugInvestigationsResponse>) => {
    await markInterruptedInvestigations();
    const investigations = await prisma.bugInvestigation.findMany({
      orderBy: { created_at: 'desc' },
      take: 100,
      select: {
        id: true,
        description: true,
        status: true,
        created_at: true,
        User: { select: { prenom: true, nom_de_famille: true } },
      },
    });
    res.status(200).send({ ok: true, data: { investigations }, error: '' });
  })
);

router.post(
  '/bug-resolution',
  catchErrors(async (req: express.Request, res: express.Response<AdminNewBugInvestigationResponse>) => {
    const { message, text, error } = buildUserMessage(req.body);
    if (error !== null) {
      res.status(400).send({ ok: false, data: null, error });
      return;
    }
    const user = req.user as User;
    const investigation = await prisma.bugInvestigation.create({
      data: {
        user_id: user.id,
        description: text || '(capture d’écran)',
        messages: [message] as unknown as Prisma.InputJsonValue,
      },
    });
    startInvestigation(investigation.id);
    res.status(200).send({ ok: true, data: { id: investigation.id }, error: '' });
  })
);

router.post(
  '/bug-resolution/:id/message',
  catchErrors(async (req: express.Request, res: express.Response<AdminNewBugInvestigationResponse>) => {
    const { message, error } = buildUserMessage(req.body);
    if (error !== null) {
      res.status(400).send({ ok: false, data: null, error });
      return;
    }
    const investigation = await prisma.bugInvestigation.findUnique({ where: { id: req.params.id } });
    if (!investigation) {
      res.status(404).send({ ok: false, data: null, error: 'Conversation introuvable' });
      return;
    }
    if (investigation.status === BugInvestigationStatus.EN_COURS) {
      res.status(409).send({ ok: false, data: null, error: 'Albert est encore en train de répondre' });
      return;
    }
    const messages = investigation.messages as unknown as Array<BugInvestigationMessage>;
    await prisma.bugInvestigation.update({
      where: { id: investigation.id },
      data: {
        status: BugInvestigationStatus.EN_COURS,
        error: null,
        messages: [...messages, message] as unknown as Prisma.InputJsonValue,
      },
    });
    startInvestigation(investigation.id);
    res.status(200).send({ ok: true, data: { id: investigation.id }, error: '' });
  })
);

router.get(
  '/bug-resolution/:id',
  catchErrors(async (req: express.Request, res: express.Response<AdminBugInvestigationResponse>) => {
    await markInterruptedInvestigations();
    const investigation = await prisma.bugInvestigation.findUnique({
      where: { id: req.params.id },
      include: { User: { select: { prenom: true, nom_de_famille: true } } },
    });
    if (!investigation) {
      res.status(404).send({ ok: false, data: null, error: 'Conversation introuvable' });
      return;
    }
    res.status(200).send({
      ok: true,
      data: {
        investigation: {
          ...investigation,
          messages: investigation.messages as unknown as Array<BugInvestigationMessage>,
        },
      },
      error: '',
    });
  })
);

export default router;
