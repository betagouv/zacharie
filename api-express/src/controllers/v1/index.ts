import express from 'express';
import feiRouter from './fei.ts';
import carcassesRouter from './carcasse.ts';
import passport from 'passport';
import swaggerUi from 'swagger-ui-express';
import swaggerEntityDocument from './swagger-entity.json';
import swaggerThirdPartyDocument from './swagger-third-party.json';

const router: express.Router = express.Router();

router.use('/fei', passport.initialize({ userProperty: 'apiKeyLog' }), feiRouter);
router.use('/carcasse', passport.initialize({ userProperty: 'apiKeyLog' }), carcassesRouter);

// Entity API Documentation (direct access)
router.use('/docs/entity', swaggerUi.serve);
router.get(
  '/docs/entity',
  swaggerUi.setup(swaggerEntityDocument, {
    customSiteTitle: 'API Zacharie - Accès Direct Entité',
    customfavIcon: '/favicon.ico',
  }),
);

// Third-party API Documentation (user delegation)
router.use('/docs/third-party', swaggerUi.serve);
router.get(
  '/docs/third-party',
  swaggerUi.setup(swaggerThirdPartyDocument, {
    customSiteTitle: 'API Zacharie - Accès Tiers',
    customfavIcon: '/favicon.ico',
  }),
);

// Keep the old route for backward compatibility, but redirect to entity docs
router.get('/api-docs', (req, res) => {
  res.redirect('/v1/docs/entity');
});

export default router;
