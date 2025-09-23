import express from 'express';
import feiRouter from './fei.ts';
import approvalRequestRouter from './approval-request.ts';
import carcassesRouter from './carcasse.ts';
import passport from 'passport';
import swaggerUi from 'swagger-ui-express';
import swaggerCleDediee from './swagger-cle-dediee.json';
import swaggerTiercePartie from './swagger-tierce-partie.json';

const router: express.Router = express.Router();

router.use('/approval-request', passport.initialize({ userProperty: 'apiKeyLog' }), approvalRequestRouter);
router.use('/fei', passport.initialize({ userProperty: 'apiKeyLog' }), feiRouter);
router.use('/carcasse', passport.initialize({ userProperty: 'apiKeyLog' }), carcassesRouter);

// Entity API Documentation (direct access)
router.use('/docs/cle-dediee', swaggerUi.serve);
router.get(
  '/docs/cle-dediee',
  swaggerUi.setup(swaggerCleDediee, {
    customSiteTitle: 'API Zacharie - Accès Direct Entité',
    customfavIcon: '/favicon.ico',
  }),
);

// Third-party API Documentation (user delegation)
router.use('/docs/tierces-parties', swaggerUi.serve);
router.get(
  '/docs/tierces-parties',
  swaggerUi.setup(swaggerTiercePartie, {
    customSiteTitle: 'API Zacharie - Accès Tiers',
    customfavIcon: '/favicon.ico',
  }),
);

export default router;
