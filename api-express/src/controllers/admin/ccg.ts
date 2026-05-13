import express from 'express';
import { catchErrors } from '~/middlewares/errors';
const router: express.Router = express.Router();
import prisma from '~/prisma';
import { EntityTypes } from '@prisma/client';
import type {
  AdminCcgPreviewResponse,
  CcgPreviewRow,
  CcgPreviewModifiedRow,
  AdminCcgImportResponse,
} from '~/types/responses';

router.post(
  '/ccg/preview',
  catchErrors(
    async (
      req: express.Request,
      res: express.Response<AdminCcgPreviewResponse>,
      next: express.NextFunction
    ) => {
      const { ccgs } = req.body as { ccgs: CcgPreviewRow[] };
      if (!Array.isArray(ccgs) || ccgs.length === 0) {
        res.status(400).send({
          ok: false,
          data: { nouveaux: [], modifies: [], unchanged_count: 0 },
          error: 'ccgs requis',
        });
        return;
      }
      const numeroDdecpps = ccgs.map((c) => c.numero_ddecpp);
      const existingEntities = await prisma.entity.findMany({
        where: {
          numero_ddecpp: { in: numeroDdecpps },
          type: EntityTypes.CCG,
          deleted_at: null,
        },
        select: {
          numero_ddecpp: true,
          nom_d_usage: true,
          address_ligne_1: true,
          code_postal: true,
          ville: true,
          siret: true,
        },
      });
      const existingByNumero: Record<
        string,
        { nom_d_usage: string; address_ligne_1: string; code_postal: string; ville: string; siret: string }
      > = {};
      for (const e of existingEntities) {
        if (e.numero_ddecpp) {
          existingByNumero[e.numero_ddecpp] = {
            nom_d_usage: e.nom_d_usage ?? '',
            address_ligne_1: e.address_ligne_1 ?? '',
            code_postal: e.code_postal ?? '',
            ville: e.ville ?? '',
            siret: e.siret ?? '',
          };
        }
      }

      const nouveaux: CcgPreviewRow[] = [];
      const modifies: CcgPreviewModifiedRow[] = [];
      let unchanged_count = 0;

      for (const row of ccgs) {
        const ex = existingByNumero[row.numero_ddecpp];
        if (!ex) {
          nouveaux.push(row);
        } else if (
          row.nom_d_usage !== ex.nom_d_usage ||
          row.address_ligne_1 !== ex.address_ligne_1 ||
          row.code_postal !== ex.code_postal ||
          row.ville !== ex.ville ||
          row.siret !== ex.siret
        ) {
          modifies.push({ ...row, existing: ex });
        } else {
          unchanged_count++;
        }
      }

      res.status(200).send({ ok: true, data: { nouveaux, modifies, unchanged_count }, error: '' });
    }
  )
);

router.post(
  '/ccg/import',
  catchErrors(
    async (
      req: express.Request,
      res: express.Response<AdminCcgImportResponse>,
      next: express.NextFunction
    ) => {
      const { ccgs } = req.body as {
        ccgs: Array<{
          numero_ddecpp: string;
          nom_d_usage: string;
          address_ligne_1: string;
          address_ligne_2: string;
          code_postal: string;
          ville: string;
          siret: string;
          action: 'create' | 'update' | 'skip';
        }>;
      };
      if (!Array.isArray(ccgs) || ccgs.length === 0) {
        res
          .status(400)
          .send({ ok: false, data: { created: 0, updated: 0, skipped: 0 }, error: 'ccgs requis' });
        return;
      }

      let created = 0;
      let updated = 0;
      let skipped = 0;

      for (const ccg of ccgs) {
        if (ccg.action === 'skip') {
          skipped++;
          continue;
        }
        const entityData = {
          nom_d_usage: ccg.nom_d_usage || '',
          raison_sociale: ccg.nom_d_usage || '',
          address_ligne_1: ccg.address_ligne_1 || '',
          address_ligne_2: ccg.address_ligne_2 || '',
          code_postal: ccg.code_postal || '',
          ville: ccg.ville || '',
          siret: ccg.siret || null,
          numero_ddecpp: ccg.numero_ddecpp,
        };
        if (ccg.action === 'create') {
          await prisma.entity.create({
            data: {
              ...entityData,
              type: EntityTypes.CCG,
              zacharie_compatible: true,
            },
          });
          created++;
        } else if (ccg.action === 'update') {
          await prisma.entity.updateMany({
            where: {
              numero_ddecpp: ccg.numero_ddecpp,
              type: EntityTypes.CCG,
              deleted_at: null,
            },
            data: entityData,
          });
          updated++;
        }
      }

      res.status(200).send({ ok: true, data: { created, updated, skipped }, error: '' });
    }
  )
);

export default router;
