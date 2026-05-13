import express from 'express';
import passport from 'passport';
import userRouter from './user.ts';
import entityRouter from './entity.ts';
import apiKeyRouter from './api-key.ts';
import feiRouter from './fei.ts';
import officialCfeiRouter from './official-cfei.ts';
import carcasseRouter from './carcasse.ts';
import analyticsRouter from './analytics.ts';
import ccgRouter from './ccg.ts';

const router: express.Router = express.Router();

router.use(passport.authenticate('admin', { session: false }));

router.use(userRouter);
router.use(entityRouter);
router.use(apiKeyRouter);
router.use(feiRouter);
router.use(officialCfeiRouter);
router.use(carcasseRouter);
router.use(analyticsRouter);
router.use(ccgRouter);

export default router;
