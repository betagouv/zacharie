import express from 'express';
import passport from 'passport';
import { catchErrors } from '~/middlewares/errors';
import type { CarcasseIntermediaireResponse } from '~/types/responses';
const router: express.Router = express.Router();
import prisma from '~/prisma';
import type { PrismaClient } from '@prisma/client';
import { CarcasseIntermediaire, Prisma } from '@prisma/client';

// Type for Prisma transaction client
type PrismaTransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

/**
 * Core save logic for CarcasseIntermediaire without Express req/res
 * Returns the saved carcasse intermediaire
 */
export async function saveCarcasseIntermediaire(
  feiNumero: string,
  intermediaireId: string,
  zacharieCarcasseId: string,
  body: Prisma.CarcasseIntermediaireUncheckedCreateInput,
  tx: PrismaTransactionClient = prisma,
): Promise<CarcasseIntermediaire> {
  // Check if FEI exists
  const existingFei = await tx.fei.findUnique({
    where: { numero: feiNumero },
  });
  if (!existingFei) {
    throw new Error('Fiche non trouvée');
  }

  // Check if Carcasse exists
  const existingCarcasse = await tx.carcasse.findFirst({
    where: {
      zacharie_carcasse_id: zacharieCarcasseId,
      fei_numero: feiNumero,
    },
  });
  if (!existingCarcasse) {
    throw new Error('Carcasse not found');
  }

  // Build the data object
  const data: Prisma.CarcasseIntermediaireUncheckedCreateInput = {
    fei_numero: feiNumero,
    numero_bracelet: existingCarcasse.numero_bracelet,
    zacharie_carcasse_id: existingCarcasse.zacharie_carcasse_id,
    intermediaire_id: intermediaireId,
    intermediaire_entity_id: body.intermediaire_entity_id,
    intermediaire_role: body.intermediaire_role,
    intermediaire_user_id: body.intermediaire_user_id,
    is_synced: true,
  };

  if (body.hasOwnProperty(Prisma.CarcasseIntermediaireScalarFieldEnum.commentaire)) {
    data.commentaire = body[Prisma.CarcasseIntermediaireScalarFieldEnum.commentaire];
  }
  if (body.hasOwnProperty(Prisma.CarcasseIntermediaireScalarFieldEnum.intermediaire_poids)) {
    data.intermediaire_poids = body[Prisma.CarcasseIntermediaireScalarFieldEnum.intermediaire_poids];
  }
  if (body.hasOwnProperty(Prisma.CarcasseIntermediaireScalarFieldEnum.prise_en_charge)) {
    data.prise_en_charge = body[Prisma.CarcasseIntermediaireScalarFieldEnum.prise_en_charge];
  }
  if (body.hasOwnProperty(Prisma.CarcasseIntermediaireScalarFieldEnum.ecarte_pour_inspection)) {
    data.ecarte_pour_inspection = body[Prisma.CarcasseIntermediaireScalarFieldEnum.ecarte_pour_inspection];
  }
  if (body.hasOwnProperty(Prisma.CarcasseIntermediaireScalarFieldEnum.check_manuel)) {
    data.check_manuel = body[Prisma.CarcasseIntermediaireScalarFieldEnum.check_manuel];
  }
  if (body.hasOwnProperty(Prisma.CarcasseIntermediaireScalarFieldEnum.manquante)) {
    data.manquante = body[Prisma.CarcasseIntermediaireScalarFieldEnum.manquante];
  }
  if (body.hasOwnProperty(Prisma.CarcasseIntermediaireScalarFieldEnum.refus)) {
    data.refus = body[Prisma.CarcasseIntermediaireScalarFieldEnum.refus];
  }
  if (body.hasOwnProperty(Prisma.CarcasseIntermediaireScalarFieldEnum.decision_at)) {
    data.decision_at = body[Prisma.CarcasseIntermediaireScalarFieldEnum.decision_at];
  }
  if (body.hasOwnProperty(Prisma.CarcasseIntermediaireScalarFieldEnum.prise_en_charge_at)) {
    data.prise_en_charge_at = body[Prisma.CarcasseIntermediaireScalarFieldEnum.prise_en_charge_at];
  }
  if (
    body.hasOwnProperty(Prisma.CarcasseIntermediaireScalarFieldEnum.intermediaire_prochain_detenteur_id_cache)
  ) {
    data.intermediaire_prochain_detenteur_id_cache =
      body[Prisma.CarcasseIntermediaireScalarFieldEnum.intermediaire_prochain_detenteur_id_cache];
  }
  if (
    body.hasOwnProperty(Prisma.CarcasseIntermediaireScalarFieldEnum.intermediaire_prochain_detenteur_role_cache)
  ) {
    data.intermediaire_prochain_detenteur_role_cache =
      body[Prisma.CarcasseIntermediaireScalarFieldEnum.intermediaire_prochain_detenteur_role_cache];
  }
  if (body.hasOwnProperty(Prisma.CarcasseIntermediaireScalarFieldEnum.intermediaire_depot_type)) {
    data.intermediaire_depot_type = body[Prisma.CarcasseIntermediaireScalarFieldEnum.intermediaire_depot_type];
  }
  if (body.hasOwnProperty(Prisma.CarcasseIntermediaireScalarFieldEnum.intermediaire_depot_entity_id)) {
    data.intermediaire_depot_entity_id =
      body[Prisma.CarcasseIntermediaireScalarFieldEnum.intermediaire_depot_entity_id];
  }
  if (body.hasOwnProperty(Prisma.CarcasseIntermediaireScalarFieldEnum.nombre_d_animaux_acceptes)) {
    data.nombre_d_animaux_acceptes =
      body[Prisma.CarcasseIntermediaireScalarFieldEnum.nombre_d_animaux_acceptes] ?? null;
  }

  const carcasseIntermediaire = await tx.carcasseIntermediaire.upsert({
    where: {
      fei_numero_zacharie_carcasse_id_intermediaire_id: {
        fei_numero: feiNumero,
        zacharie_carcasse_id: existingCarcasse.zacharie_carcasse_id,
        intermediaire_id: intermediaireId,
      },
    },
    create: data,
    update: data,
  });

  return carcasseIntermediaire;
}

router.post(
  '/:fei_numero/:intermediaire_id/:zacharie_carcasse_id',
  passport.authenticate('user', { session: false }),
  catchErrors(
    async (
      req: express.Request,
      res: express.Response<CarcasseIntermediaireResponse>,
      next: express.NextFunction,
    ) => {
      const body = req.body;
      const user = req.user;
      if (!user.activated) {
        res.status(400).send({
          ok: false,
          data: { carcasseIntermediaire: null },
          error: "Le compte n'est pas activé",
        });
        return;
      }
      const { fei_numero, intermediaire_id, zacharie_carcasse_id } = req.params;
      if (!fei_numero) {
        res.status(400).send({
          ok: false,
          data: { carcasseIntermediaire: null },
          error: 'Le numéro de fiche est obligatoire',
        });
        return;
      }
      if (!zacharie_carcasse_id) {
        res.status(400).send({
          ok: false,
          data: { carcasseIntermediaire: null },
          error: 'Le numéro de la carcasse est obligatoire',
        });
        return;
      }
      if (!intermediaire_id) {
        res.status(400).send({
          ok: false,
          data: { carcasseIntermediaire: null },
          error: "L'identifiant du destinataire est obligatoire",
        });
        return;
      }

      try {
        const carcasseIntermediaire = await saveCarcasseIntermediaire(
          fei_numero,
          intermediaire_id,
          zacharie_carcasse_id,
          body,
        );

        res.status(200).send({
          ok: true,
          data: { carcasseIntermediaire },
          error: '',
        });
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === 'Fiche non trouvée') {
            res.status(400).send({
              ok: false,
              data: { carcasseIntermediaire: null },
              error: error.message,
            });
            return;
          }
          if (error.message === 'Carcasse not found') {
            res.status(400).send({
              ok: false,
              data: { carcasseIntermediaire: null },
              error: error.message,
            });
            return;
          }
        }
        throw error;
      }
    },
  ),
);

router.get(
  '/:fei_numero/:intermediaire_id/:zacharie_carcasse_id',
  passport.authenticate('user', { session: false }),
  catchErrors(
    async (
      req: express.Request,
      res: express.Response<CarcasseIntermediaireResponse>,
      next: express.NextFunction,
    ) => {
      if (!req.user.activated) {
        res.status(400).send({
          ok: false,
          data: { carcasseIntermediaire: null },
          error: "Le compte n'est pas activé",
        });
        return;
      }
      if (!req.params.fei_numero) {
        res.status(400).send({ ok: false, data: null, error: 'Missing fei_numero' });
        return;
      }
      const fei = await prisma.fei.findUnique({
        where: {
          numero: req.params.fei_numero as string,
        },
      });
      if (!fei) {
        res.status(400).send({ ok: false, data: null, error: 'Unauthorized' });
        return;
      }
      if (!req.params.intermediaire_id) {
        res.status(400).send({ ok: false, data: null, error: 'Missing intermediaire_id' });
        return;
      }
      if (!req.params.zacharie_carcasse_id) {
        res.status(400).send({ ok: false, data: null, error: 'Missing zacharie_carcasse_id' });
        return;
      }
      const carcasseIntermediaire = await prisma.carcasseIntermediaire.findUnique({
        where: {
          fei_numero_zacharie_carcasse_id_intermediaire_id: {
            fei_numero: req.params.fei_numero,
            zacharie_carcasse_id: req.params.zacharie_carcasse_id,
            intermediaire_id: req.params.intermediaire_id,
          },
        },
      });
      if (!carcasseIntermediaire) {
        res.status(400).send({
          ok: false,
          data: null,
          error: 'Missing caracsse intermediaire',
        });
        return;
      }

      res.status(200).send({
        ok: true,
        data: { carcasseIntermediaire },
        error: '',
      });
    },
  ),
);

export default router;
