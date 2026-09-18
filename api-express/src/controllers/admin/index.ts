import express from 'express';
import passport from 'passport';
import type { User } from '@prisma/client';
import { PROCONNECT_REQUIRED } from '~/middlewares/passport';
import userRouter from './user.ts';
import entityRouter from './entity.ts';
import apiKeyRouter from './api-key.ts';
import feiRouter from './fei.ts';
import officialCfeiRouter from './official-cfei.ts';
import carcasseRouter from './carcasse.ts';
import analyticsRouter from './analytics.ts';
import ccgRouter from './ccg.ts';

const router: express.Router = express.Router();

// Callback custom : on distingue "pas admin / session invalide" (401, le front déconnecte)
// de "admin sans ProConnect" (403 + code, le front redirige vers /app/proconnect)
router.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  passport.authenticate(
    'admin',
    { session: false },
    (error: Error | null, user: User | false | null, info?: { code?: string }) => {
      if (error) return next(error);
      if (info?.code === PROCONNECT_REQUIRED) {
        res.status(403).send({ ok: false, data: null, message: '', error: PROCONNECT_REQUIRED });
        return;
      }
      if (!user) {
        res.status(401).send({ ok: false, data: null, message: '', error: 'Unauthorized' });
        return;
      }
      req.user = user;
      next();
    }
  )(req, res, next);
});

// Le front admin vérifie ici que la session admin est complète (ProConnect inclus) avant d'afficher quoi que ce soit
router.get('/session', (_req: express.Request, res: express.Response) => {
  res.status(200).send({ ok: true, data: null, message: '', error: '' });
});

router.use(userRouter);
router.use(entityRouter);
router.use(apiKeyRouter);
router.use(feiRouter);
router.use(officialCfeiRouter);
router.use(carcasseRouter);
router.use(analyticsRouter);
router.use(ccgRouter);

export default router;
