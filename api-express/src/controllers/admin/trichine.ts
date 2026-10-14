import express from 'express';
import z from 'zod';
import { catchErrors } from '~/middlewares/errors';
import prisma from '~/prisma';
import type {
  AdminEmailEntrantResponse,
  AdminEmailsEntrantsResponse,
  AdminTrichineDocumentsResponse,
  AdminTrichineEchantillonsResponse,
  AdminTrichineFtpsResponse,
  AdminTrichinePoolsResponse,
} from '~/types/responses';
import { EmailEntrantStatut } from '~/utils/trichine-inbound-email';
import { analyserEmailEntrant } from '~/utils/trichine-inbound-ocr';

const router: express.Router = express.Router();

/**
 * Vue d'ensemble trichine pour l'admin : emails entrants, documents, pools, FTP, échantillons.
 *
 * Chaque section a sa route et renvoie des lignes **plates** : le tri et les filtres se font
 * côté client sur les colonnes affichées, comme les listes trichine métier. Les listes sont
 * bornées aux plus récentes — c'est un outil de diagnostic, pas un export.
 */

const LIMITE_PAR_DEFAUT = 200;
const LIMITE_MAX = 500;

function limite(req: express.Request): number {
  const demande = Number(req.query.limit) || LIMITE_PAR_DEFAUT;
  // Une valeur négative serait interprétée par Prisma comme « les N derniers, à l'envers »
  return Math.min(Math.max(demande, 1), LIMITE_MAX);
}

/**
 * Journal des emails reçus sur les adresses de dépôt (cf utils/trichine-inbound-email.ts).
 * Tout message y figure, y compris ceux qu'on a écartés : c'est de là qu'on diagnostique
 * un rapport qui « n'est jamais arrivé », et qu'on voit qui écrit à ces adresses.
 */
router.get(
  '/trichine/emails-entrants',
  catchErrors(async (req: express.Request, res: express.Response<AdminEmailsEntrantsResponse>) => {
    const [emails, total] = await Promise.all([
      prisma.emailEntrant.findMany({ orderBy: { recu_at: 'desc' }, take: limite(req) }),
      prisma.emailEntrant.count(),
    ]);

    res.status(200).send({ ok: true, data: { emails, total }, error: '' });
  })
);

/**
 * Relance l'analyse d'un message : OCR des pièces jointes encore illisibles, rattachement et
 * lecture du résultat. Synchrone — l'OCR prend quelques secondes et l'admin attend sa réponse.
 */
router.post(
  '/trichine/emails-entrants/:id/analyser',
  catchErrors(async (req: express.Request, res: express.Response<AdminEmailEntrantResponse>) => {
    const emailEntrant = await prisma.emailEntrant.findUnique({ where: { id: req.params.id } });
    if (!emailEntrant) {
      res.status(404).send({ ok: false, data: null, error: 'Message introuvable' });
      return;
    }

    const ocr = await analyserEmailEntrant(emailEntrant);
    const email = await prisma.emailEntrant.findUnique({ where: { id: emailEntrant.id } });

    res.status(200).send({ ok: true, data: { email, ocr }, error: '' });
  })
);

const statutSchema = z.object({
  statut: z.enum(Object.values(EmailEntrantStatut) as [string, ...string[]]),
});

// Repasser un message à A_ANALYSER est la façon de rejouer une analyse après une panne d'OCR
router.put(
  '/trichine/emails-entrants/:id/statut',
  catchErrors(async (req: express.Request, res: express.Response<AdminEmailEntrantResponse>) => {
    const body = statutSchema.safeParse(req.body);
    if (!body.success) {
      res.status(400).send({ ok: false, data: null, error: 'Statut invalide' });
      return;
    }
    const existing = await prisma.emailEntrant.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).send({ ok: false, data: null, error: 'Message introuvable' });
      return;
    }

    const email = await prisma.emailEntrant.update({
      where: { id: existing.id },
      data: { statut: body.data.statut },
    });

    res.status(200).send({ ok: true, data: { email, ocr: null }, error: '' });
  })
);

/* -------------------------------------------------------------------------- */
/* Documents                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Rapports et pièces jointes. Les lignes sans pool ni FTP sont les documents **non rattachés** :
 * personne ne les voit dans l'application, c'est ici qu'on les repère.
 */
router.get(
  '/trichine/documents',
  catchErrors(async (req: express.Request, res: express.Response<AdminTrichineDocumentsResponse>) => {
    const documents = await prisma.trichineDocument.findMany({
      where: { deleted_at: null },
      orderBy: { date_ajout: 'desc' },
      take: limite(req),
      include: {
        TrichinePool: { select: { reference_pool: true } },
        TrichineFTP: { select: { numero_fiche: true } },
        AjouteParUser: { select: { prenom: true, nom_de_famille: true, email: true } },
      },
    });

    const rows = documents.map((document) => ({
      id: document.id,
      type: document.type,
      source: document.source,
      nom_fichier: document.nom_fichier,
      date_ajout: document.date_ajout,
      pool_reference: document.TrichinePool?.reference_pool ?? null,
      ftp_numero: document.TrichineFTP?.numero_fiche ?? null,
      rattachement_source: document.rattachement_source,
      rattachement_indice: document.rattachement_indice,
      texte_source: document.texte_source,
      longueur_texte: document.texte_extrait?.length ?? 0,
      email_expediteur: document.email_expediteur,
      email_sujet: document.email_sujet,
      depose_par: document.AjouteParUser
        ? `${document.AjouteParUser.prenom ?? ''} ${document.AjouteParUser.nom_de_famille ?? ''}`.trim() ||
          document.AjouteParUser.email
        : null,
    }));

    res.status(200).send({ ok: true, data: { documents: rows }, error: '' });
  })
);

/** Texte lu dans un document — ce sur quoi le rattachement et le résultat ont été décidés. */
router.get(
  '/trichine/document/:id/texte',
  catchErrors(async (req: express.Request, res: express.Response) => {
    const document = await prisma.trichineDocument.findUnique({
      where: { id: req.params.id },
      select: { id: true, nom_fichier: true, texte_extrait: true, texte_source: true },
    });
    if (!document) {
      res.status(404).send({ ok: false, data: null, error: 'Document introuvable' });
      return;
    }
    res.status(200).send({ ok: true, data: { document }, error: '' });
  })
);

/* -------------------------------------------------------------------------- */
/* Pools                                                                       */
/* -------------------------------------------------------------------------- */

router.get(
  '/trichine/pools',
  catchErrors(async (req: express.Request, res: express.Response<AdminTrichinePoolsResponse>) => {
    const pools = await prisma.trichinePool.findMany({
      where: { deleted_at: null },
      orderBy: { created_at: 'desc' },
      take: limite(req),
      include: {
        TrichineEchantillons: {
          where: { deleted_at: null },
          select: { Carcasse: { select: { numero_bracelet: true, espece: true } } },
        },
        TrichinePoolFTPs: {
          select: {
            reference_labo: true,
            TrichineFTP: {
              select: {
                numero_fiche: true,
                DestinataireEntity: { select: { nom_d_usage: true, raison_sociale: true, is_lnr: true } },
              },
            },
          },
        },
      },
    });

    const rows = pools.map((pool) => {
      const lien = pool.TrichinePoolFTPs.at(-1);
      const destinataire = lien?.TrichineFTP.DestinataireEntity;
      return {
        id: pool.id,
        reference_pool: pool.reference_pool,
        type: pool.type,
        statut: pool.statut,
        resultat_analyse: pool.resultat_analyse,
        parasite_identifie: pool.parasite_identifie,
        date_constitution: pool.date_constitution,
        date_fin_analyse: pool.date_fin_analyse,
        nb_echantillons: pool.TrichineEchantillons.length,
        bracelets: pool.TrichineEchantillons.map((echantillon) => echantillon.Carcasse?.numero_bracelet)
          .filter(Boolean)
          .join(', '),
        especes: [...new Set(pool.TrichineEchantillons.map((echantillon) => echantillon.Carcasse?.espece))]
          .filter(Boolean)
          .join(', '),
        ftp_numero: lien?.TrichineFTP.numero_fiche ?? null,
        laboratoire: destinataire?.nom_d_usage || destinataire?.raison_sociale || (destinataire ? '—' : null),
        est_lnr: destinataire?.is_lnr ?? false,
        reference_labo: lien?.reference_labo ?? null,
      };
    });

    res.status(200).send({ ok: true, data: { pools: rows }, error: '' });
  })
);

/* -------------------------------------------------------------------------- */
/* FTP                                                                         */
/* -------------------------------------------------------------------------- */

router.get(
  '/trichine/ftps',
  catchErrors(async (req: express.Request, res: express.Response<AdminTrichineFtpsResponse>) => {
    const ftps = await prisma.trichineFTP.findMany({
      where: { deleted_at: null },
      orderBy: { date_creation: 'desc' },
      take: limite(req),
      include: {
        DestinataireEntity: { select: { nom_d_usage: true, raison_sociale: true, is_lnr: true } },
        ExpediteurUser: { select: { prenom: true, nom_de_famille: true, email: true } },
        ExpediteurEntity: { select: { nom_d_usage: true, raison_sociale: true } },
        TrichinePoolFTPs: { select: { TrichinePool: { select: { reference_pool: true } } } },
      },
    });

    const rows = ftps.map((ftp) => ({
      id: ftp.id,
      numero_fiche: ftp.numero_fiche,
      statut_logistique: ftp.statut_logistique,
      statut_analytique: ftp.statut_analytique,
      date_creation: ftp.date_creation,
      date_envoi: ftp.date_envoi,
      date_annulation: ftp.date_annulation,
      laboratoire: ftp.DestinataireEntity.nom_d_usage || ftp.DestinataireEntity.raison_sociale || '—',
      est_lnr: ftp.DestinataireEntity.is_lnr,
      expediteur:
        ftp.ExpediteurEntity?.nom_d_usage ||
        ftp.ExpediteurEntity?.raison_sociale ||
        `${ftp.ExpediteurUser.prenom ?? ''} ${ftp.ExpediteurUser.nom_de_famille ?? ''}`.trim() ||
        ftp.ExpediteurUser.email,
      nb_pools: ftp.TrichinePoolFTPs.length,
      pools: ftp.TrichinePoolFTPs.map((lien) => lien.TrichinePool.reference_pool).join(', '),
      // Une fiche de confirmation est née d'un pool douteux : c'est le signal à repérer
      est_confirmation: !!ftp.ftp_parent_id,
    }));

    res.status(200).send({ ok: true, data: { ftps: rows }, error: '' });
  })
);

/* -------------------------------------------------------------------------- */
/* Échantillons                                                                */
/* -------------------------------------------------------------------------- */

router.get(
  '/trichine/echantillons',
  catchErrors(async (req: express.Request, res: express.Response<AdminTrichineEchantillonsResponse>) => {
    const echantillons = await prisma.trichineEchantillon.findMany({
      where: { deleted_at: null },
      orderBy: { created_at: 'desc' },
      take: limite(req),
      include: {
        Carcasse: { select: { numero_bracelet: true, espece: true, fei_numero: true } },
        TrichinePool: { select: { reference_pool: true, resultat_analyse: true } },
        PreleveParUser: { select: { prenom: true, nom_de_famille: true, email: true } },
      },
    });

    const rows = echantillons.map((echantillon) => ({
      id: echantillon.id,
      reference_echantillon: echantillon.reference_echantillon,
      type: echantillon.type,
      statut: echantillon.statut,
      resultat_analyse: echantillon.resultat_analyse,
      date_prelevement: echantillon.date_prelevement,
      masse_grammes: echantillon.masse_grammes,
      site_prelevement: echantillon.site_prelevement,
      numero_bracelet: echantillon.Carcasse?.numero_bracelet ?? null,
      espece: echantillon.Carcasse?.espece ?? null,
      fei_numero: echantillon.Carcasse?.fei_numero ?? null,
      pool_reference: echantillon.TrichinePool?.reference_pool ?? null,
      preleve_par:
        `${echantillon.PreleveParUser.prenom ?? ''} ${echantillon.PreleveParUser.nom_de_famille ?? ''}`.trim() ||
        echantillon.PreleveParUser.email,
    }));

    res.status(200).send({ ok: true, data: { echantillons: rows }, error: '' });
  })
);

export default router;
