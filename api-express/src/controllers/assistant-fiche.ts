import express from 'express';
import passport from 'passport';
import { Prisma, User, UserRoles } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { catchErrors } from '~/middlewares/errors';
import { assistantFicheRateLimit } from '~/middlewares/auth-rate-limit';
import prisma from '~/prisma';
import { ALBERT_API_KEY, ALBERT_MODEL } from '~/config';
import { applyFicheData, extractFicheData, type AssistantChatMessage } from '~/service/assistant-fiche';
import type { AssistantFicheResponse, AssistantTranscriptionResponse } from '~/types/responses';
import { SyncRejectedError } from '~/utils/sync-errors';
import { transcribeAudio } from '~/third-parties/albert';
import { capture } from '~/third-parties/sentry';

const router: express.Router = express.Router();

const bodySchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().trim().min(1).max(4000) }))
    .min(1)
    .max(40),
  // libellés des propriétaires initiaux que le formulaire propose (associations, détenteurs, soi-même)
  premier_detenteur_options: z.array(z.string().trim().min(1).max(200)).max(50).default([]),
});

router.post(
  '/:fei_numero',
  passport.authenticate('user', { session: false }),
  assistantFicheRateLimit,
  catchErrors(async (req: express.Request, res: express.Response<AssistantFicheResponse>) => {
    const user = req.user as User;
    const isExaminateurInitial = user.roles.includes(UserRoles.CHASSEUR) && !!user.numero_cfei;
    if (!isExaminateurInitial) {
      res
        .status(403)
        .send({ ok: false, data: null, error: 'Seul un examinateur initial peut utiliser Zacharie' });
      return;
    }
    if (!ALBERT_API_KEY) {
      res.status(503).send({ ok: false, data: null, error: 'Assistant indisponible' });
      return;
    }
    const body = bodySchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).send({ ok: false, data: null, error: 'Message invalide' });
      return;
    }
    const fei = await prisma.fei.findUnique({ where: { numero: req.params.fei_numero } });
    if (!fei || fei.deleted_at || fei.examinateur_initial_user_id !== user.id) {
      res.status(404).send({ ok: false, data: null, error: 'Fiche introuvable' });
      return;
    }
    // une fois l'examen validé, la fiche part au premier détenteur : on ne la remplit plus ici
    if (fei.examinateur_initial_approbation_mise_sur_le_marche) {
      res.status(403).send({ ok: false, data: null, error: 'La fiche est déjà validée' });
      return;
    }
    const existingCarcasses = await prisma.carcasse.findMany({
      where: { fei_numero: fei.numero, deleted_at: null },
      orderBy: { created_at: 'asc' },
    });

    const requestId = randomUUID();
    const messages = body.data.messages as Array<AssistantChatMessage>;
    // un log par échange : le message, ce qu'Albert en a compris et la réponse, écrit ou non
    const exchangeLog: Record<string, unknown> = {
      assistant_request_id: requestId,
      model: ALBERT_MODEL,
      user_message: messages[messages.length - 1].content,
      tool_arguments: null,
      validation_issues: null,
      reply: null,
      error: null,
    };
    try {
      const { extraction, text, toolArguments, issues } = await extractFicheData(
        messages,
        fei,
        existingCarcasses,
        body.data.premier_detenteur_options as Array<string>,
        user
      );
      exchangeLog.tool_arguments = toolArguments;
      exchangeLog.validation_issues = issues;
      if (!extraction) {
        exchangeLog.reply = text;
        res.status(200).send({
          ok: true,
          data: {
            reply: text,
            fei,
            carcasses: existingCarcasses,
            commune_recherchee: null,
            premier_detenteur_choisi: null,
          },
          error: '',
        });
        return;
      }

      const result = await applyFicheData(extraction, fei, existingCarcasses, user, requestId);
      // la commune et le propriétaire initial sont confirmés par le front, qui les enregistre
      const reply =
        result.lignes.length > 0
          ? ["C'est noté :", ...result.lignes.map((ligne) => `- ${ligne}`)].join('\n')
          : result.commune_recherchee || result.premier_detenteur_choisi
            ? ''
            : "Je n'ai trouvé aucune donnée à enregistrer.";
      exchangeLog.reply = reply;
      res.status(200).send({
        ok: true,
        data: {
          reply,
          fei: result.fei,
          carcasses: result.carcasses,
          commune_recherchee: result.commune_recherchee,
          premier_detenteur_choisi: result.premier_detenteur_choisi,
        },
        error: '',
      });
    } catch (error) {
      exchangeLog.error = (error as Error).message;
      if (error instanceof SyncRejectedError) {
        res.status(403).send({ ok: false, data: null, error: error.message });
        return;
      }
      throw error;
    } finally {
      await prisma.log
        .createMany({
          data: [
            {
              user_id: user.id,
              user_role: UserRoles.CHASSEUR,
              fei_numero: fei.numero,
              action: 'examinateur-assistant-message',
              history: exchangeLog as Prisma.InputJsonValue,
              date: new Date(),
            },
          ],
        })
        .catch((error) => capture(error as Error, { extra: { context: 'assistant_exchange_log' }, user }));
    }
  })
);

// ~1 min d'audio compressé (webm/opus, mp4/aac) : reste sous la limite de 5 Mo du corps JSON en base64
const MAX_AUDIO_BYTES = 3 * 1024 * 1024;

const transcriptionBodySchema = z.object({
  audio: z.string().min(1),
  mime_type: z.string().regex(/^audio\/[a-z0-9.+-]+(;.*)?$/i),
});

router.post(
  '/:fei_numero/transcription',
  passport.authenticate('user', { session: false }),
  assistantFicheRateLimit,
  catchErrors(async (req: express.Request, res: express.Response<AssistantTranscriptionResponse>) => {
    const user = req.user as User;
    const isExaminateurInitial = user.roles.includes(UserRoles.CHASSEUR) && !!user.numero_cfei;
    if (!isExaminateurInitial) {
      res
        .status(403)
        .send({ ok: false, data: null, error: 'Seul un examinateur initial peut utiliser Zacharie' });
      return;
    }
    if (!ALBERT_API_KEY) {
      res.status(503).send({ ok: false, data: null, error: 'Dictée indisponible' });
      return;
    }
    const body = transcriptionBodySchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).send({ ok: false, data: null, error: 'Enregistrement invalide' });
      return;
    }
    const audio = Buffer.from(body.data.audio, 'base64');
    if (audio.length > MAX_AUDIO_BYTES) {
      res.status(413).send({ ok: false, data: null, error: 'Enregistrement trop long' });
      return;
    }
    const fei = await prisma.fei.findUnique({ where: { numero: req.params.fei_numero } });
    if (!fei || fei.deleted_at || fei.examinateur_initial_user_id !== user.id) {
      res.status(404).send({ ok: false, data: null, error: 'Fiche introuvable' });
      return;
    }
    const text = await transcribeAudio(audio, body.data.mime_type);
    res.status(200).send({ ok: true, data: { text }, error: '' });
  })
);

export default router;
