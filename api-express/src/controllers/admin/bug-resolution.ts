import express from 'express';
import dayjs from 'dayjs';
import { BugInvestigationStatus, type User } from '@prisma/client';
import { catchErrors } from '~/middlewares/errors';
import prisma from '~/prisma';
import { capture } from '~/third-parties/sentry';
import { runBugInvestigation } from '~/service/bug-investigator';
import type { BugInvestigationStep } from '~/types/bug-investigation';
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
    const description = typeof req.body.description === 'string' ? req.body.description.trim() : '';
    const images: Array<unknown> = Array.isArray(req.body.images) ? req.body.images : [];
    if (!description && !images.length) {
      res.status(400).send({ ok: false, data: null, error: 'Décrivez le problème ou joignez une capture' });
      return;
    }
    if (
      images.length > MAX_IMAGES ||
      images.some((image) => typeof image !== 'string' || !image.startsWith('data:image/'))
    ) {
      res.status(400).send({ ok: false, data: null, error: `${MAX_IMAGES} images au maximum` });
      return;
    }
    const user = req.user as User;
    const investigation = await prisma.bugInvestigation.create({
      data: { user_id: user.id, description, images: images as Array<string> },
    });
    runBugInvestigation(investigation.id).catch((error) =>
      capture(error, { extra: { bugInvestigationId: investigation.id } })
    );
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
      res.status(404).send({ ok: false, data: null, error: 'Enquête introuvable' });
      return;
    }
    res.status(200).send({
      ok: true,
      data: {
        investigation: {
          ...investigation,
          steps: investigation.steps as unknown as Array<BugInvestigationStep>,
          images: investigation.images as Array<string>,
        },
      },
      error: '',
    });
  })
);

export default router;
