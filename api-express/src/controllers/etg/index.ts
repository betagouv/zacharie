import '~/prisma';
import passport from 'passport';
import express from 'express';
const router: express.Router = express.Router();

import entiteRouter from './entite.ts';
import feiRouter from './fei.ts';
import feiCarcasseRouter from './carcasse.ts';
import feiCarcasseIntermediaireRouter from './carcasse-intermediaire.ts';
import searchRouter from './search.ts';
import syncRouter from './sync.ts';
import apiKeyApprovalRouter from './api-key-approval.ts';
import { UserRoles } from '@prisma/client';

function etgMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (req.user?.roles.includes(UserRoles.ETG)) {
    return next();
  }
  return res.status(403).send({ error: 'Unauthorized' });
}

router.use('/entite', passport.initialize(), etgMiddleware, entiteRouter);
router.use('/fei', passport.initialize(), etgMiddleware, feiRouter);
router.use('/carcasse', passport.initialize(), etgMiddleware, feiCarcasseRouter);
router.use('/carcasse-intermediaire', passport.initialize(), etgMiddleware, feiCarcasseIntermediaireRouter);
router.use('/sync', passport.initialize(), etgMiddleware, syncRouter);
router.use('/search', passport.initialize(), etgMiddleware, searchRouter);
router.use('/api-key-approval', passport.initialize(), etgMiddleware, apiKeyApprovalRouter);

export default router;
