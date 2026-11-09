import express from 'express';
import { z } from 'zod';
import { EntityTypes } from '@prisma/client';
import { catchErrors } from '~/middlewares/errors';
import prisma from '~/prisma';
import { sanitize } from '~/utils/sanitize';
import { updateOrCreateBrevoCompany } from '~/third-parties/brevo';
import type {
  AdminPremiersDetenteursPreviewResponse,
  AdminPremiersDetenteursImportResponse,
  PremierDetenteurImportRow,
} from '~/types/responses';

const router: express.Router = express.Router();

const rowsSchema = z.object({
  premiers_detenteurs: z
    .array(
      z.object({
        raison_sociale: z.string().trim().min(1),
        code_postal: z.string().trim(),
        ville: z.string().trim(),
      })
    )
    .min(1),
});

// une association de chasse est identifiée par sa raison sociale, son code postal et sa commune,
// comme à la création par un chasseur (POST /entite/association-de-chasse)
const keyOf = (row: PremierDetenteurImportRow) =>
  [row.raison_sociale, row.code_postal, row.ville].map((v) => v.toLowerCase()).join('|');

function parseRows(body: unknown): PremierDetenteurImportRow[] | null {
  const result = rowsSchema.safeParse(body);
  if (!result.success) return null;
  const rows = result.data.premiers_detenteurs.map((row) => ({
    raison_sociale: sanitize(row.raison_sociale),
    code_postal: sanitize(row.code_postal),
    ville: sanitize(row.ville),
  }));
  // une ligne en double dans le fichier n'est importée qu'une fois
  const byKey = new Map<string, PremierDetenteurImportRow>();
  for (const row of rows) {
    if (!byKey.has(keyOf(row))) byKey.set(keyOf(row), row);
  }
  return [...byKey.values()];
}

async function splitNewAndExisting(rows: PremierDetenteurImportRow[]) {
  const existingEntities = await prisma.entity.findMany({
    where: {
      type: EntityTypes.PREMIER_DETENTEUR,
      deleted_at: null,
      raison_sociale: { in: rows.map((r) => r.raison_sociale), mode: 'insensitive' },
    },
    select: { raison_sociale: true, code_postal: true, ville: true },
  });
  const existingKeys = new Set(
    existingEntities.map((e) =>
      keyOf({
        raison_sociale: e.raison_sociale ?? '',
        code_postal: e.code_postal ?? '',
        ville: e.ville ?? '',
      })
    )
  );
  const nouveaux = rows.filter((row) => !existingKeys.has(keyOf(row)));
  const existants = rows.filter((row) => existingKeys.has(keyOf(row)));
  return { nouveaux, existants };
}

router.post(
  '/premiers-detenteurs/preview',
  catchErrors(async (req: express.Request, res: express.Response<AdminPremiersDetenteursPreviewResponse>) => {
    const rows = parseRows(req.body);
    if (!rows) {
      res.status(400).send({
        ok: false,
        data: { nouveaux: [], existants: [] },
        error: 'premiers_detenteurs requis',
      });
      return;
    }
    const data = await splitNewAndExisting(rows);
    res.status(200).send({ ok: true, data, error: '' });
  })
);

router.post(
  '/premiers-detenteurs/import',
  catchErrors(async (req: express.Request, res: express.Response<AdminPremiersDetenteursImportResponse>) => {
    const rows = parseRows(req.body);
    if (!rows) {
      res
        .status(400)
        .send({ ok: false, data: { created: 0, skipped: 0 }, error: 'premiers_detenteurs requis' });
      return;
    }
    // on revérifie à l'import : un double clic ou un second import du même fichier ne crée pas de doublon
    const { nouveaux, existants } = await splitNewAndExisting(rows);
    for (const row of nouveaux) {
      const createdEntity = await prisma.entity.create({
        data: {
          raison_sociale: row.raison_sociale,
          nom_d_usage: row.raison_sociale,
          code_postal: row.code_postal,
          ville: row.ville,
          type: EntityTypes.PREMIER_DETENTEUR,
          zacharie_compatible: true,
        },
      });
      await updateOrCreateBrevoCompany(createdEntity);
    }
    res
      .status(200)
      .send({ ok: true, data: { created: nouveaux.length, skipped: existants.length }, error: '' });
  })
);

export default router;
