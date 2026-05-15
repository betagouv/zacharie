import express from 'express';
import { catchErrors } from '~/middlewares/errors';
import { FeiOwnerRole } from '@prisma/client';
import { populateDb } from '../../scripts/populate-test-db';

const router: express.Router = express.Router();

// Test-only route to reset the DB in-process (avoids the 3s tsx + Prisma boot
// that shelling out to populate-test-db.ts costs per test).
// Only mounted when NODE_ENV=test, see ~/index.ts.
router.post(
  '/reset',
  catchErrors(async (req: express.Request, res: express.Response) => {
    const role = (req.query.role as string) || undefined;
    await populateDb(role as FeiOwnerRole | undefined);
    res.status(200).send({ ok: true, role: role || null });
  })
);

export default router;
