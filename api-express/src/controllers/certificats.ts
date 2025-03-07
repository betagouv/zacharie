import express from 'express';
import passport from 'passport';
import { catchErrors } from '../middlewares/errors';
import type { CertificatResponse, CarcassesGetForRegistryResponse } from '~/types/responses';
const router: express.Router = express.Router();
import prisma from '~/prisma';
import dayjs from 'dayjs';
import { CarcasseCertificatType, EntityTypes, IPM1Decision, Prisma } from '@prisma/client';
import { generateConsigneDocx } from '~/templates/get-consigne-docx';
import { generateCertficatId, generateDBCertificat, generateDecisionId } from '~/utils/generate-certificats';
import { generateSaisieDocx } from '~/templates/get-saisie-docx';
import { generateLeveeSaisieDocx } from '~/templates/get-levee-saisie-docx';
import { generateLaissezPasserSanitaireDocx } from '~/templates/get-laissez-passer-sanitaire';

router.get(
  '/:zacharie_carcasse_id/all',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const { zacharie_carcasse_id } = req.params;
    const certificats = await prisma.carcasseCertificat.findMany({
      where: {
        zacharie_carcasse_id: zacharie_carcasse_id,
      },
      orderBy: {
        created_at: 'desc',
      },
    });
    res.send(certificats);
  }),
);

router.get(
  '/carcasse/:zacharie_carcasse_id/:certificat',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const { zacharie_carcasse_id } = req.params;
    const certificatType = req.params.certificat as CarcasseCertificatType;

    const certificatResponse = await generateDBCertificat(certificatType, zacharie_carcasse_id);
    if (!certificatResponse.ok) {
      res.status(400).send(certificatResponse);
      return;
    }

    if (req.query.download !== 'true') {
      res.status(200).send(certificatResponse);
      return;
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename=consigne.docx');

    if (certificatType === CarcasseCertificatType.CC) {
      const docBuffer = await generateConsigneDocx(certificatResponse.data.certificat);
      res.send(docBuffer);
    }

    if (certificatType === CarcasseCertificatType.CSP || certificatType === CarcasseCertificatType.CST) {
      const docBuffer = await generateSaisieDocx(certificatResponse.data.certificat);
      res.send(docBuffer);
    }

    if (certificatType === CarcasseCertificatType.LC) {
      const docBuffer = await generateLeveeSaisieDocx(certificatResponse.data.certificat);
      res.send(docBuffer);
    }

    if (certificatType === CarcasseCertificatType.LPS) {
      const docBuffer = await generateLaissezPasserSanitaireDocx(certificatResponse.data.certificat);
      res.send(docBuffer);
    }
  }),
);

router.get(
  '/:certificat_id',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const { certificat_id } = req.params;

    const certificat = await prisma.carcasseCertificat.findUnique({
      where: {
        certificat_id: certificat_id,
      },
    });

    if (!certificat) {
      res.status(404).send({
        ok: false,
        data: null,
        error: 'Certificat non trouvé',
      });
      return;
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename=consigne.docx');

    if (certificat.type === CarcasseCertificatType.CC) {
      const docBuffer = await generateConsigneDocx(certificat);
      res.send(docBuffer);
    }

    if (certificat.type === CarcasseCertificatType.CSP || certificat.type === CarcasseCertificatType.CST) {
      const docBuffer = await generateSaisieDocx(certificat);
      res.send(docBuffer);
    }

    if (certificat.type === CarcasseCertificatType.LC) {
      const docBuffer = await generateLeveeSaisieDocx(certificat);
      res.send(docBuffer);
    }

    if (certificat.type === CarcasseCertificatType.LPS) {
      const docBuffer = await generateLaissezPasserSanitaireDocx(certificat);
      res.send(docBuffer);
    }
  }),
);

export default router;
