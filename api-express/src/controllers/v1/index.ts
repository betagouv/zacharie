import express from 'express';
import feiRouter from './fei.ts';
import approvalRequestRouter from './approval-request.ts';
import carcassesRouter from './carcasse.ts';
import passport from 'passport';
import swaggerUi from 'swagger-ui-express';
import accessTokenRouter from './access-token.ts';
import swaggerCleDediee from './swagger-cle-dediee.json';
import swaggerTiercePartie from './swagger-tierce-partie.json';

const router: express.Router = express.Router();

router.use('/approval-request', passport.initialize({ userProperty: 'apiKey' }), approvalRequestRouter);
router.use('/access-token', passport.initialize({ userProperty: 'apiKey' }), accessTokenRouter);
router.use('/fei', passport.initialize({ userProperty: 'apiKey' }), feiRouter);
router.use('/carcasse', passport.initialize({ userProperty: 'apiKey' }), carcassesRouter);

// Entity API Documentation (direct access)
router.use('/docs/cle-dediee', swaggerUi.serveFiles(swaggerCleDediee));
router.get(
  '/docs/cle-dediee',
  swaggerUi.setup(swaggerCleDediee, {
    customSiteTitle: 'API Zacharie - Accès Direct Entité',
    customfavIcon: 'https://zacharie.beta.gouv.fr/favicon.png',
  }),
);

// Third-party API Documentation (user delegation)
router.use('/docs/tierces-parties', swaggerUi.serveFiles(swaggerTiercePartie));
router.get(
  '/docs/tierces-parties',
  swaggerUi.setup(swaggerTiercePartie, {
    customSiteTitle: 'API Zacharie - Accès Tiers',
    customfavIcon: 'https://zacharie.beta.gouv.fr/favicon.png',
  }),
);

export default router;
