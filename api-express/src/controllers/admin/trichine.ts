import express from 'express';
import { catchErrors } from '~/middlewares/errors';
import prisma from '~/prisma';
import type {
  AdminTrichineDocumentsResponse,
  AdminTrichineEchantillonsResponse,
  AdminTrichineFtpsResponse,
  AdminTrichinePoolsResponse,
} from '~/types/responses';

const router: express.Router = express.Router();

/**
 * Vue d'ensemble trichine pour l'admin : documents, pools, FTP, échantillons.
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

/* -------------------------------------------------------------------------- */
/* Documents                                                                   */
/* -------------------------------------------------------------------------- */

// Rapports et photographies déposés par les laboratoires
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
      depose_par:
        `${document.AjouteParUser.prenom ?? ''} ${document.AjouteParUser.nom_de_famille ?? ''}`.trim() ||
        document.AjouteParUser.email,
    }));

    res.status(200).send({ ok: true, data: { documents: rows }, error: '' });
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
        Aliases: { select: { reference: true }, orderBy: { created_at: 'asc' } },
        TrichinePoolFTPs: {
          select: {
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
        aliases: pool.Aliases.map((alias) => alias.reference).join(', '),
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
