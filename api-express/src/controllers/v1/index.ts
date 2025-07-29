import express from 'express';
import feiRouter from './fei.ts';
import carcassesRouter from './carcasse.ts';
import passport from 'passport';

const router: express.Router = express.Router();

router.use('/fei', passport.initialize({ userProperty: 'apiKeyLog' }), feiRouter);
router.use('/carcasse', passport.initialize({ userProperty: 'apiKeyLog' }), carcassesRouter);

export default router;
