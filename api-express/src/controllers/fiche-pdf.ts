import express from 'express';
import passport from 'passport';
import { CarcasseStatus, FeiOwnerRole, UserRoles } from '@prisma/client';
import type { Carcasse } from '@prisma/client';
import { catchErrors } from '~/middlewares/errors';
import prisma from '~/prisma';
import { RequestWithUser } from '~/types/request';
import { getCarcasseAccessWhere } from '~/utils/carcasse-access';
import { getCarcasseStatusLabelForEmail } from '~/utils/get-carcasse-status';
import { getFicheExtraitPdfBuffer } from '~/templates/get-fiche-extrait-pdf';

const router: express.Router = express.Router();

function getStatutLabel(carcasse: Carcasse) {
  if (carcasse.svi_carcasse_status === CarcasseStatus.REFUS_ETG_COLLECTEUR) {
    const motif = carcasse.intermediaire_carcasse_refus_motif;
    return motif ? `Refusée par l'intermédiaire : ${motif}` : "Refusée par l'intermédiaire";
  }
  if (carcasse.svi_carcasse_status === CarcasseStatus.MANQUANTE_ETG_COLLECTEUR) {
    return "Manquante chez l'intermédiaire";
  }
  return getCarcasseStatusLabelForEmail(carcasse);
}

function getIntermediaireRoleLabel(role: FeiOwnerRole | null) {
  return role === FeiOwnerRole.COLLECTEUR_PRO ? 'Collecteur' : 'ETG';
}

// Extrait PDF de la fiche pour le SVI et l'ETG : seulement les carcasses de leur périmètre de lecture.
router.get(
  '/:fei_numero',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response) => {
    if (!req.user.activated) {
      res.status(400).send({ ok: false, data: null, error: "Le compte n'est pas activé" });
      return;
    }
    if (!req.user.roles.includes(UserRoles.SVI) && !req.user.roles.includes(UserRoles.ETG)) {
      res.status(403).send({
        ok: false,
        data: null,
        error: 'Seuls les services vétérinaires et les ETG peuvent télécharger cette fiche',
      });
      return;
    }
    const accessWhere = await getCarcasseAccessWhere(req.user);
    if (!accessWhere) {
      res.status(403).send({ ok: false, data: null, error: "Vous n'avez pas les permissions." });
      return;
    }
    const feiNumero = req.params.fei_numero;
    const carcasses = await prisma.carcasse.findMany({
      where: { fei_numero: feiNumero, deleted_at: null, ...accessWhere },
      orderBy: { numero_bracelet: 'asc' },
    });
    const fei = carcasses.length
      ? await prisma.fei.findFirst({ where: { numero: feiNumero, deleted_at: null } })
      : null;
    if (!fei) {
      res.status(404).send({ ok: false, data: null, error: 'Fiche introuvable' });
      return;
    }

    const carcasseIds = carcasses.map((carcasse) => carcasse.zacharie_carcasse_id);
    const intermediaires = await prisma.carcasseIntermediaire.findMany({
      where: { zacharie_carcasse_id: { in: carcasseIds }, deleted_at: null },
      orderBy: { prise_en_charge_at: 'asc' },
      select: { intermediaire_id: true, intermediaire_entity_id: true, intermediaire_role: true, prise_en_charge_at: true },
      distinct: ['intermediaire_id'],
    });
    const sviEntityId = carcasses.find((carcasse) => carcasse.svi_entity_id)?.svi_entity_id ?? null;
    const entityIds = [...new Set(intermediaires.map((i) => i.intermediaire_entity_id))];
    if (sviEntityId) entityIds.push(sviEntityId);
    const entities = await prisma.entity.findMany({
      where: { id: { in: entityIds } },
      select: { id: true, nom_d_usage: true },
    });
    const entityName = (id: string) => entities.find((entity) => entity.id === id)?.nom_d_usage ?? '-';
    const examinateur = fei.examinateur_initial_user_id
      ? await prisma.user.findUnique({
          where: { id: fei.examinateur_initial_user_id },
          select: { prenom: true, nom_de_famille: true },
        })
      : null;

    const pdf = await getFicheExtraitPdfBuffer({
      numero: fei.numero,
      dateMiseAMort: fei.date_mise_a_mort,
      communeMiseAMort: fei.commune_mise_a_mort,
      examinateur: examinateur ? `${examinateur.prenom} ${examinateur.nom_de_famille}` : null,
      premierDetenteur: carcasses[0].premier_detenteur_name_cache,
      intermediaires: intermediaires.map((intermediaire) => ({
        nom: entityName(intermediaire.intermediaire_entity_id),
        role: getIntermediaireRoleLabel(intermediaire.intermediaire_role),
        priseEnChargeAt: intermediaire.prise_en_charge_at,
      })),
      svi: sviEntityId ? entityName(sviEntityId) : null,
      carcasses: carcasses.map((carcasse) => ({
        numeroBracelet: carcasse.numero_bracelet,
        espece: carcasse.espece,
        nombreAnimaux: carcasse.nombre_d_animaux,
        statut: getStatutLabel(carcasse),
      })),
      genereLe: new Date(),
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="fiche-${fei.numero}.pdf"`);
    res.status(200).send(pdf);
  })
);

export default router;
