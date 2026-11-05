import express from 'express';
import { FeiOwnerRole } from '@prisma/client';
import { catchErrors } from '~/middlewares/errors';
import { applyHistoryTriggers } from '../../scripts/apply-history-triggers.ts';
import { populateDb } from '../../scripts/populate-test-db.ts';

const router: express.Router = express.Router();

// la base e2e vient de `prisma db push`, sans triggers d'historique : posés une seule fois par process
let historyTriggersReady: Promise<void> | undefined;

// appelé par resetDb() (e2e/scripts/reset-db.ts) avant chaque spec Playwright
router.post(
  '/reset',
  catchErrors(async (req: express.Request, res: express.Response) => {
    const role: unknown = req.body?.role;
    if (role !== undefined && typeof role !== 'string') {
      res.status(400).send({ ok: false, error: 'role must be a string' });
      return;
    }
    historyTriggersReady ??= applyHistoryTriggers();
    await historyTriggersReady;
    // les états de seed (SeedRole côté e2e) débordent FeiOwnerRole : populateDb les compare en string
    await populateDb(role as FeiOwnerRole | undefined);
    res.status(200).send({ ok: true });
  })
);

export default router;
