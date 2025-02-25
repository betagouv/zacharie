import express from 'express';
import passport from 'passport';
import { catchErrors } from '../middlewares/errors';
import type { CertificatResponse, CarcassesGetForRegistryResponse } from '~/types/responses';
const router: express.Router = express.Router();
import prisma from '~/prisma';
import dayjs from 'dayjs';
import { Prisma } from '@prisma/client';
import path from 'path';
import fs from 'fs/promises';
import { Document, Patcher } from 'docx';

async function patchDocument(templatePath: string, replacements: Record<string, string>): Promise<Buffer> {
  const content = await fs.readFile(templatePath);

  const patcher = new Patcher(content);

  // Apply all replacements
  Object.entries(replacements).forEach(([search, replace]) => {
    patcher.replace(search, replace);
  });

  return patcher.getBuffer();
}

router.post(
  '/consigne/:zacharie_carcasse_id',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const body: Prisma.CarcasseUncheckedCreateInput = req.body;
    const user = req.user;
    const { zacharie_carcasse_id } = req.params;

    if (!zacharie_carcasse_id) {
      res.status(400).send({
        ok: false,
        data: { certificat: null },
        error: 'Le numéro de la carcasse est obligatoire',
      } satisfies CertificatResponse);
      return;
    }
    let existingCarcasse = await prisma.carcasse.findFirst({
      where: {
        zacharie_carcasse_id: zacharie_carcasse_id,
      },
    });
    if (!existingCarcasse) {
      res.status(404).send({
        ok: false,
        data: { certificat: null },
        error: 'Carcasse non trouvée',
      } satisfies CertificatResponse);
      return;
    }

    const templatePath = path.join(__dirname, '../templates/20241230_certificat de consigne.docx');

    try {
      const docBuffer = await patchDocument(templatePath, {
        '[Nom du département du SVI]': 'Département Test',
        // Add more replacements as needed:
        // '[Another placeholder]': 'replacement value',
      });

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      );
      res.setHeader('Content-Disposition', 'attachment; filename=certificat-consigne.docx');

      res.send(docBuffer);
    } catch (error) {
      console.error('Document generation error:', error);
      res.status(500).send({
        ok: false,
        data: { certificat: null },
        error: 'Erreur lors de la génération du document',
      } satisfies CertificatResponse);
    }
  }),
);

export default router;
