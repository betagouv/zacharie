import express from 'express';
import passport from 'passport';
import { catchErrors } from '~/middlewares/errors';
import prisma from '~/prisma';
import {
  CarcasseModificationRequestStatus,
  CarcasseModificationRequestType,
  Prisma,
  UserRoles,
} from '@prisma/client';
import sendNotificationToUser from '~/service/notifications';
import { capture } from '~/third-parties/sentry';

const router: express.Router = express.Router();

// --- Helpers ---------------------------------------------------------------

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://zacharie.beta.gouv.fr';

const requestPopulatedInclude = {
  Carcasse: true,
  RequestedByUser: true,
  RequestedByEntity: true,
  ReviewedByUser: true,
} satisfies Prisma.CarcasseModificationRequestInclude;

async function notifyExaminateur(modReq: {
  id: string;
  fei_numero: string;
  type: CarcasseModificationRequestType;
  zacharie_carcasse_id: string;
}) {
  const carcasse = await prisma.carcasse.findUnique({
    where: { zacharie_carcasse_id: modReq.zacharie_carcasse_id },
    include: { Fei: { include: { FeiExaminateurInitialUser: true } } },
  });
  const examinateur = carcasse?.Fei?.FeiExaminateurInitialUser;
  if (!examinateur) return;

  const title =
    modReq.type === CarcasseModificationRequestType.BRACELET_RENAME
      ? `Modification d'un numéro de bracelet à approuver — fiche ${modReq.fei_numero}`
      : `Nouvelle carcasse à approuver — fiche ${modReq.fei_numero}`;
  const link = `${FRONTEND_URL}/app/chasseur/demandes-de-modification`;
  const body =
    modReq.type === CarcasseModificationRequestType.BRACELET_RENAME
      ? `Un intermédiaire signale un numéro de bracelet incorrect sur la fiche ${modReq.fei_numero}. Approuvez ou refusez la demande : ${link}`
      : `Un intermédiaire a ajouté une carcasse manquante à la fiche ${modReq.fei_numero}. Signez ou refusez l'examen : ${link}`;

  try {
    await sendNotificationToUser({
      user: examinateur,
      title,
      body,
      email: body,
      notificationLogAction: `MOD_REQ_CREATED_${modReq.id}`,
    });
  } catch (error) {
    capture(error as Error, { extra: { modReqId: modReq.id, examinateurId: examinateur.id } });
  }
}

async function notifyRequester(modReq: {
  id: string;
  status: CarcasseModificationRequestStatus;
  requested_by_user_id: string;
  fei_numero: string;
}) {
  const requester = await prisma.user.findUnique({ where: { id: modReq.requested_by_user_id } });
  if (!requester) return;

  const approved = modReq.status === CarcasseModificationRequestStatus.APPROVED;
  const title = approved
    ? `Votre demande de modification a été approuvée — fiche ${modReq.fei_numero}`
    : `Votre demande de modification a été refusée — fiche ${modReq.fei_numero}`;
  const body = approved
    ? `L'examinateur initial a approuvé votre demande sur la fiche ${modReq.fei_numero}. Vous pouvez reprendre le traitement de la carcasse.`
    : `L'examinateur initial a refusé votre demande sur la fiche ${modReq.fei_numero}.`;

  try {
    await sendNotificationToUser({
      user: requester,
      title,
      body,
      email: body,
      notificationLogAction: `MOD_REQ_${modReq.status}_${modReq.id}`,
    });
  } catch (error) {
    capture(error as Error, { extra: { modReqId: modReq.id, requesterId: requester.id } });
  }
}

// --- Routes ----------------------------------------------------------------

// GET /carcasse-modification-request/for-examinateur
// Lists PENDING requests where the current user is the examinateur initial of the underlying carcasse.
router.get(
  '/for-examinateur',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: express.Request, res: express.Response) => {
    if (!req.user.activated) {
      res.status(400).send({ ok: false, data: null, error: "Le compte n'est pas activé" });
      return;
    }
    if (!req.user.roles.includes(UserRoles.CHASSEUR)) {
      res.status(403).send({ ok: false, data: null, error: 'Unauthorized' });
      return;
    }

    const requests = await prisma.carcasseModificationRequest.findMany({
      where: {
        status: CarcasseModificationRequestStatus.PENDING,
        deleted_at: null,
        Carcasse: {
          examinateur_initial_user_id: req.user.id,
          deleted_at: null,
        },
      },
      include: requestPopulatedInclude,
      orderBy: { requested_at: 'desc' },
    });

    res.status(200).send({ ok: true, data: { requests }, error: '' });
  })
);

// POST /carcasse-modification-request/rename
// Body: { zacharie_carcasse_id, numero_bracelet_after, comment_intermediaire?, requested_by_entity_id }
router.post(
  '/rename',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: express.Request, res: express.Response) => {
    if (!req.user.activated) {
      res.status(400).send({ ok: false, data: null, error: "Le compte n'est pas activé" });
      return;
    }

    const { zacharie_carcasse_id, numero_bracelet_after, comment_intermediaire, requested_by_entity_id } =
      req.body as {
        zacharie_carcasse_id: string;
        numero_bracelet_after: string;
        comment_intermediaire?: string;
        requested_by_entity_id: string;
      };

    if (!zacharie_carcasse_id || !numero_bracelet_after || !requested_by_entity_id) {
      res.status(400).send({ ok: false, data: null, error: 'Champs requis manquants' });
      return;
    }

    const carcasse = await prisma.carcasse.findUnique({
      where: { zacharie_carcasse_id },
      include: {
        CarcasseModificationRequests: {
          where: { status: CarcasseModificationRequestStatus.PENDING, deleted_at: null },
        },
      },
    });
    if (!carcasse || carcasse.deleted_at) {
      res.status(400).send({ ok: false, data: null, error: 'Carcasse introuvable' });
      return;
    }
    if (carcasse.CarcasseModificationRequests.length > 0) {
      res
        .status(409)
        .send({ ok: false, data: null, error: 'Une demande est déjà en cours sur cette carcasse' });
      return;
    }
    if (numero_bracelet_after === carcasse.numero_bracelet) {
      res.status(400).send({ ok: false, data: null, error: "Le nouveau numéro est identique à l'actuel" });
      return;
    }

    const created = await prisma.carcasseModificationRequest.create({
      data: {
        type: CarcasseModificationRequestType.BRACELET_RENAME,
        status: CarcasseModificationRequestStatus.PENDING,
        zacharie_carcasse_id,
        fei_numero: carcasse.fei_numero,
        requested_by_user_id: req.user.id,
        requested_by_entity_id,
        comment_intermediaire: comment_intermediaire ?? null,
        numero_bracelet_before: carcasse.numero_bracelet,
        numero_bracelet_after,
      },
      include: requestPopulatedInclude,
    });

    await notifyExaminateur(created);

    res.status(200).send({ ok: true, data: { request: created }, error: '' });
  })
);

// POST /carcasse-modification-request/new
// Body: { fei_numero, zacharie_carcasse_id (proposed), carcasse: <pre-fill>, comment_intermediaire?, requested_by_entity_id }
router.post(
  '/new',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: express.Request, res: express.Response) => {
    if (!req.user.activated) {
      res.status(400).send({ ok: false, data: null, error: "Le compte n'est pas activé" });
      return;
    }

    const {
      fei_numero,
      zacharie_carcasse_id,
      carcasse: carcasseDraft,
      comment_intermediaire,
      requested_by_entity_id,
    } = req.body as {
      fei_numero: string;
      zacharie_carcasse_id: string;
      carcasse: Partial<Prisma.CarcasseUncheckedCreateInput>;
      comment_intermediaire?: string;
      requested_by_entity_id: string;
    };

    if (!fei_numero || !zacharie_carcasse_id || !carcasseDraft || !requested_by_entity_id) {
      res.status(400).send({ ok: false, data: null, error: 'Champs requis manquants' });
      return;
    }

    const fei = await prisma.fei.findUnique({
      where: { numero: fei_numero },
      include: { FeiExaminateurInitialUser: true },
    });
    if (!fei || fei.deleted_at) {
      res.status(400).send({ ok: false, data: null, error: 'Fiche introuvable' });
      return;
    }
    if (!fei.examinateur_initial_user_id) {
      res.status(400).send({ ok: false, data: null, error: "Pas d'examinateur initial sur la fiche" });
      return;
    }

    const existing = await prisma.carcasse.findUnique({ where: { zacharie_carcasse_id } });
    if (existing) {
      res.status(409).send({ ok: false, data: null, error: 'Une carcasse avec cet identifiant existe déjà' });
      return;
    }

    // Insert the Carcasse (intermediaire pre-fill) without examinateur signature, then the request.
    const result = await prisma.$transaction(async (tx) => {
      const newCarcasse = await tx.carcasse.create({
        data: {
          zacharie_carcasse_id,
          fei_numero,
          numero_bracelet: carcasseDraft.numero_bracelet!,
          espece: carcasseDraft.espece ?? null,
          type: carcasseDraft.type ?? null,
          nombre_d_animaux: carcasseDraft.nombre_d_animaux ?? null,
          heure_mise_a_mort: carcasseDraft.heure_mise_a_mort ?? null,
          heure_evisceration: carcasseDraft.heure_evisceration ?? null,
          date_mise_a_mort: fei.date_mise_a_mort,
          // examinateur fields intentionally left blank — to be filled on approval
          examinateur_initial_user_id: fei.examinateur_initial_user_id,
          // ownership: inherit current ownership of the FEI so the carcasse joins the flow once approved
          created_by_user_id: req.user.id,
          premier_detenteur_user_id: fei.premier_detenteur_user_id,
          premier_detenteur_entity_id: fei.premier_detenteur_entity_id,
        },
      });
      const created = await tx.carcasseModificationRequest.create({
        data: {
          type: CarcasseModificationRequestType.NEW_CARCASSE,
          status: CarcasseModificationRequestStatus.PENDING,
          zacharie_carcasse_id: newCarcasse.zacharie_carcasse_id,
          fei_numero,
          requested_by_user_id: req.user.id,
          requested_by_entity_id,
          comment_intermediaire: comment_intermediaire ?? null,
        },
        include: requestPopulatedInclude,
      });
      return { newCarcasse, created };
    });

    await notifyExaminateur(result.created);

    res
      .status(200)
      .send({ ok: true, data: { request: result.created, carcasse: result.newCarcasse }, error: '' });
  })
);

// POST /carcasse-modification-request/:id/approve
// Body for RENAME: empty (or { reviewer_comment })
// Body for NEW: { examinateur_anomalies_carcasse, examinateur_anomalies_abats, examinateur_commentaire, examinateur_carcasse_sans_anomalie, examinateur_approbation_mise_sur_le_marche }
router.post(
  '/:id/approve',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: express.Request, res: express.Response) => {
    if (!req.user.activated) {
      res.status(400).send({ ok: false, data: null, error: "Le compte n'est pas activé" });
      return;
    }

    const modReq = await prisma.carcasseModificationRequest.findUnique({
      where: { id: req.params.id },
      include: { Carcasse: true },
    });
    if (!modReq || modReq.deleted_at) {
      res.status(404).send({ ok: false, data: null, error: 'Demande introuvable' });
      return;
    }
    if (modReq.status !== CarcasseModificationRequestStatus.PENDING) {
      res.status(409).send({ ok: false, data: null, error: 'Demande déjà traitée' });
      return;
    }
    if (modReq.Carcasse.examinateur_initial_user_id !== req.user.id) {
      res.status(403).send({ ok: false, data: null, error: "Seul l'examinateur initial peut approuver" });
      return;
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (modReq.type === CarcasseModificationRequestType.BRACELET_RENAME) {
        await tx.carcasse.update({
          where: { zacharie_carcasse_id: modReq.zacharie_carcasse_id },
          data: { numero_bracelet: modReq.numero_bracelet_after! },
        });
      } else {
        // NEW_CARCASSE: examinateur fills sanitary fields + signs
        const {
          examinateur_anomalies_carcasse,
          examinateur_anomalies_abats,
          examinateur_commentaire,
          examinateur_carcasse_sans_anomalie,
          examinateur_approbation_mise_sur_le_marche,
        } = req.body as {
          examinateur_anomalies_carcasse?: string[];
          examinateur_anomalies_abats?: string[];
          examinateur_commentaire?: string;
          examinateur_carcasse_sans_anomalie?: boolean;
          examinateur_approbation_mise_sur_le_marche?: boolean;
        };

        await tx.carcasse.update({
          where: { zacharie_carcasse_id: modReq.zacharie_carcasse_id },
          data: {
            examinateur_anomalies_carcasse: examinateur_anomalies_carcasse ?? [],
            examinateur_anomalies_abats: examinateur_anomalies_abats ?? [],
            examinateur_commentaire: examinateur_commentaire ?? null,
            examinateur_carcasse_sans_anomalie: examinateur_carcasse_sans_anomalie ?? false,
            examinateur_signed_at: new Date(),
          },
        });
      }

      return tx.carcasseModificationRequest.update({
        where: { id: modReq.id },
        data: {
          status: CarcasseModificationRequestStatus.APPROVED,
          reviewed_by_user_id: req.user.id,
          reviewed_at: new Date(),
        },
        include: requestPopulatedInclude,
      });
    });

    await notifyRequester(updated);

    res.status(200).send({ ok: true, data: { request: updated }, error: '' });
  })
);

// POST /carcasse-modification-request/:id/reject
// Body: { rejection_reason? }
router.post(
  '/:id/reject',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: express.Request, res: express.Response) => {
    if (!req.user.activated) {
      res.status(400).send({ ok: false, data: null, error: "Le compte n'est pas activé" });
      return;
    }

    const modReq = await prisma.carcasseModificationRequest.findUnique({
      where: { id: req.params.id },
      include: { Carcasse: true },
    });
    if (!modReq || modReq.deleted_at) {
      res.status(404).send({ ok: false, data: null, error: 'Demande introuvable' });
      return;
    }
    if (modReq.status !== CarcasseModificationRequestStatus.PENDING) {
      res.status(409).send({ ok: false, data: null, error: 'Demande déjà traitée' });
      return;
    }
    if (modReq.Carcasse.examinateur_initial_user_id !== req.user.id) {
      res.status(403).send({ ok: false, data: null, error: "Seul l'examinateur initial peut refuser" });
      return;
    }

    const { rejection_reason } = req.body as { rejection_reason?: string };

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.carcasseModificationRequest.update({
        where: { id: modReq.id },
        data: {
          status: CarcasseModificationRequestStatus.REJECTED,
          reviewed_by_user_id: req.user!.id,
          reviewed_at: new Date(),
          rejection_reason: rejection_reason ?? null,
        },
        include: requestPopulatedInclude,
      });
      // For NEW_CARCASSE: soft-delete the carcasse the intermediaire pre-filled.
      // For BRACELET_RENAME: no side effect on the carcasse; the requesting intermediaire decides what to do (mark manquante, etc.)
      if (modReq.type === CarcasseModificationRequestType.NEW_CARCASSE) {
        await tx.carcasse.update({
          where: { zacharie_carcasse_id: modReq.zacharie_carcasse_id },
          data: { deleted_at: new Date() },
        });
      }
      return u;
    });

    await notifyRequester(updated);

    res.status(200).send({ ok: true, data: { request: updated }, error: '' });
  })
);

export default router;
