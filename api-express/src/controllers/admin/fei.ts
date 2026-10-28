import express from 'express';
import { catchErrors } from '~/middlewares/errors';
const router: express.Router = express.Router();
import prisma from '~/prisma';
import { Prisma, CarcasseStatus, CarcasseType, FeiOwnerRole, UserRoles } from '@prisma/client';
import type { User } from '@prisma/client';
import { z } from 'zod';
import type {
  AdminFeiDestinataire,
  AdminFeisResponse,
  AdminFeiDetailResponse,
  AdminFeisFilterOptionsResponse,
  AdminSoftDeleteResponse,
  AdminFeiCorrectionResponse,
} from '~/types/responses';
import { nextVersion } from '~/utils/sync-version';
import { getAdminFeiCorrectionsBlocage, getAssociationsDeChasse } from '~/utils/admin-fei-corrections';
import { setAdminAuditChanges } from '~/middlewares/admin-audit-log';
import {
  parseList,
  parseDateRange,
  parseDateTimeRange,
  entityLabel,
  userLabel,
  sortByLabel,
} from '~/utils/admin-list-filters';

// Détenteurs actuels et destinataires des fiches, lus sur les carcasses : c'est là que vit la propriété,
// et une même fiche peut partir vers plusieurs destinataires. On ignore les carcasses supprimées, sauf
// sur une fiche supprimée (ses carcasses l'ont été avec elle) que l'admin affiche toujours.
async function getFeisDestinataires(feiNumeros: Array<string>) {
  const groups = await prisma.carcasse.groupBy({
    by: [
      'fei_numero',
      'current_owner_role',
      'current_owner_entity_id',
      'current_owner_user_id',
      'next_owner_role',
      'next_owner_entity_id',
      'next_owner_user_id',
    ],
    where: {
      fei_numero: { in: feiNumeros },
      OR: [{ deleted_at: null }, { Fei: { deleted_at: { not: null } } }],
    },
    _count: { _all: true },
  });

  const entityIds = new Set<string>();
  const userIds = new Set<string>();
  for (const group of groups) {
    if (group.current_owner_entity_id) entityIds.add(group.current_owner_entity_id);
    if (group.current_owner_user_id) userIds.add(group.current_owner_user_id);
    if (group.next_owner_entity_id) entityIds.add(group.next_owner_entity_id);
    if (group.next_owner_user_id) userIds.add(group.next_owner_user_id);
  }
  const [entities, users] = await Promise.all([
    prisma.entity.findMany({
      where: { id: { in: [...entityIds] } },
      select: { id: true, nom_d_usage: true, raison_sociale: true },
    }),
    prisma.user.findMany({
      where: { id: { in: [...userIds] } },
      select: { id: true, email: true, prenom: true, nom_de_famille: true },
    }),
  ]);
  const ownerLabels: Record<string, string> = {};
  for (const entity of entities) ownerLabels[entity.id] = entityLabel(entity);
  for (const user of users) ownerLabels[user.id] = userLabel(user);

  // L'entité prime sur l'utilisateur : c'est elle qui détient, l'utilisateur agit pour elle.
  function ownerLabel(entityId: string | null, userId: string | null) {
    const id = entityId ?? userId;
    if (!id) return null;
    return ownerLabels[id] ?? id;
  }

  const byFei = new Map<string, Array<AdminFeiDestinataire>>();
  for (const group of groups) {
    const destinataires = byFei.get(group.fei_numero) ?? [];
    destinataires.push({
      current_owner_role: group.current_owner_role,
      current_owner_label: ownerLabel(group.current_owner_entity_id, group.current_owner_user_id),
      next_owner_role: group.next_owner_role,
      next_owner_label: ownerLabel(group.next_owner_entity_id, group.next_owner_user_id),
      nb_carcasses: group._count._all,
    });
    byFei.set(group.fei_numero, destinataires);
  }
  return { byFei, ownerLabels };
}

router.get(
  '/feis',
  catchErrors(
    async (req: express.Request, res: express.Response<AdminFeisResponse>, next: express.NextFunction) => {
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;
      const search = (req.query.search as string) || '';

      const examinateurIds = parseList(req.query.examinateur_ids);
      const premierDetenteurIds = parseList(req.query.premier_detenteur_ids);
      const creationContexts = parseList(req.query.creation_context);
      const avecCarcasses = parseList(req.query.avec_carcasses);
      const dateMiseAMort = parseDateRange(req.query.date_mise_a_mort_from, req.query.date_mise_a_mort_to);
      const createdAt = parseDateTimeRange(req.query.created_at_from, req.query.created_at_to);

      // Chaque filtre est un bloc indépendant : on les empile dans un AND pour ne pas
      // écraser le OR de la recherche.
      const and: Array<Prisma.FeiWhereInput> = [];
      if (search) {
        and.push({
          OR: [
            { numero: { contains: search, mode: 'insensitive' } },
            { commune_mise_a_mort: { contains: search, mode: 'insensitive' } },
          ],
        });
      }
      if (examinateurIds.length) and.push({ examinateur_initial_user_id: { in: examinateurIds } });
      if (premierDetenteurIds.length) {
        and.push({
          OR: [
            { premier_detenteur_entity_id: { in: premierDetenteurIds } },
            { premier_detenteur_user_id: { in: premierDetenteurIds } },
          ],
        });
      }
      if (creationContexts.length) and.push({ creation_context: { in: creationContexts } });
      if (dateMiseAMort) and.push({ date_mise_a_mort: dateMiseAMort });
      if (createdAt) and.push({ created_at: createdAt });
      // Les deux cases cochées ne filtrent rien, comme n'en cocher aucune.
      if (avecCarcasses.length === 1) {
        and.push(
          avecCarcasses[0] === 'avec'
            ? { Carcasses: { some: { deleted_at: null } } }
            : { Carcasses: { none: { deleted_at: null } } }
        );
      }

      // Les fiches supprimées restent listées ici : les routes admin les affichent, badgées.
      const where: Prisma.FeiWhereInput = and.length ? { AND: and } : {};

      const [feis, total] = await Promise.all([
        prisma.fei.findMany({
          where,
          orderBy: { created_at: 'desc' },
          take: limit,
          skip: offset,
          include: {
            FeiExaminateurInitialUser: { select: { email: true } },
            FeiPremierDetenteurUser: { select: { email: true } },
            FeiPremierDetenteurEntity: { select: { nom_d_usage: true } },
            _count: { select: { Carcasses: true } },
          },
        }),
        prisma.fei.count({ where }),
      ]);
      const { byFei } = await getFeisDestinataires(feis.map((fei) => fei.numero));

      res.status(200).send({
        ok: true,
        data: {
          feis: feis.map((fei) => ({ ...fei, destinataires: byFei.get(fei.numero) ?? [] })),
          total,
        },
        error: '',
      });
    }
  )
);

// Options des listes déroulantes de filtres : uniquement les acteurs qui apparaissent
// réellement dans des fiches, pour garder des listes courtes.
router.get(
  '/feis/filter-options',
  catchErrors(
    async (
      req: express.Request,
      res: express.Response<AdminFeisFilterOptionsResponse>,
      next: express.NextFunction
    ) => {
      const [examinateurRows, premierDetenteurEntityRows, premierDetenteurUserRows] = await Promise.all([
        prisma.fei.groupBy({
          by: ['examinateur_initial_user_id'],
          where: { examinateur_initial_user_id: { not: null } },
        }),
        prisma.fei.groupBy({
          by: ['premier_detenteur_entity_id'],
          where: { premier_detenteur_entity_id: { not: null } },
        }),
        prisma.fei.groupBy({
          by: ['premier_detenteur_user_id'],
          where: { premier_detenteur_user_id: { not: null } },
        }),
      ]);

      const examinateurIds = examinateurRows.map((row) => row.examinateur_initial_user_id!);
      const premierDetenteurEntityIds = premierDetenteurEntityRows.map(
        (row) => row.premier_detenteur_entity_id!
      );
      const premierDetenteurUserIds = premierDetenteurUserRows.map((row) => row.premier_detenteur_user_id!);

      const [users, entities] = await Promise.all([
        prisma.user.findMany({
          where: { id: { in: [...examinateurIds, ...premierDetenteurUserIds] } },
          select: { id: true, email: true, prenom: true, nom_de_famille: true },
        }),
        prisma.entity.findMany({
          where: { id: { in: premierDetenteurEntityIds } },
          select: { id: true, nom_d_usage: true, raison_sociale: true },
        }),
      ]);

      const usersById = new Map(users.map((user) => [user.id, user]));
      const entitiesById = new Map(entities.map((entity) => [entity.id, entity]));

      const examinateurs = sortByLabel(
        examinateurIds.map((id) => ({
          id,
          label: usersById.has(id) ? userLabel(usersById.get(id)!) : id,
        }))
      );
      const premiersDetenteurs = sortByLabel([
        ...premierDetenteurEntityIds.map((id) => ({
          id,
          label: entitiesById.has(id) ? entityLabel(entitiesById.get(id)!) : id,
        })),
        ...premierDetenteurUserIds.map((id) => ({
          id,
          label: usersById.has(id) ? userLabel(usersById.get(id)!) : id,
        })),
      ]);

      res.status(200).send({ ok: true, data: { examinateurs, premiersDetenteurs }, error: '' });
    }
  )
);

router.get(
  '/fei/:fei_numero',
  catchErrors(
    async (
      req: express.Request,
      res: express.Response<AdminFeiDetailResponse>,
      next: express.NextFunction
    ) => {
      const fei = await prisma.fei.findUnique({
        where: { numero: req.params.fei_numero },
        include: {
          Carcasses: {
            orderBy: { created_at: 'asc' },
            include: {
              _count: { select: { CarcasseIntermediaire: true } },
            },
          },
          CarcasseIntermediaire: {
            orderBy: { created_at: 'asc' },
            include: {
              CarcasseIntermediaireEntity: {
                select: {
                  nom_d_usage: true,
                  type: true,
                  numero_ddecpp: true,
                },
              },
              CarcasseIntermediaireUser: { select: { email: true } },
            },
          },
          FeiCreatedByUser: { select: { email: true } },
          FeiExaminateurInitialUser: { select: { email: true } },
          FeiPremierDetenteurUser: { select: { email: true } },
          FeiPremierDetenteurEntity: { select: { nom_d_usage: true } },
        },
      });

      if (!fei) {
        res.status(404).send({ ok: false, data: null as never, error: 'Fiche not found' });
        return;
      }

      const [{ byFei, ownerLabels }, blocages, associationsDeChasse] = await Promise.all([
        getFeisDestinataires([fei.numero]),
        getAdminFeiCorrectionsBlocage(fei.numero),
        getAssociationsDeChasse(fei.examinateur_initial_user_id),
      ]);

      res.status(200).send({
        ok: true,
        data: {
          fei,
          destinataires: byFei.get(fei.numero) ?? [],
          ownerLabels,
          corrections: { ...blocages, associationsDeChasse },
        },
        error: '',
      });
    }
  )
);

// Soft delete d'une fiche de test ou de démo, avec ses carcasses et lignes d'intermédiaire, comme la
// suppression par l'examinateur initial (syncFei). `nextVersion` rend périmée toute écriture hors
// ligne d'un client sur ces lignes, et le bump d'updated_at leur propage la suppression au prochain pull.
// Les stats (vues matérialisées, Metabase) excluent déjà les lignes où deleted_at est renseigné.
router.post(
  '/fei/:fei_numero/soft-delete',
  catchErrors(
    async (
      req: express.Request,
      res: express.Response<AdminSoftDeleteResponse>,
      next: express.NextFunction
    ) => {
      const user = req.user as User;
      const numero = req.params.fei_numero;
      const fei = await prisma.fei.findUnique({ where: { numero } });
      if (!fei) {
        res.status(404).send({ ok: false, data: null, error: 'Fiche introuvable' });
        return;
      }
      if (fei.deleted_at) {
        res.status(400).send({ ok: false, data: null, error: 'La fiche est déjà supprimée' });
        return;
      }

      const deleted_at = new Date();
      await prisma.$transaction([
        prisma.fei.update({ where: { numero }, data: { deleted_at, ...nextVersion(user.id) } }),
        prisma.carcasse.updateMany({
          where: { fei_numero: numero, deleted_at: null },
          data: { deleted_at, ...nextVersion(user.id) },
        }),
        prisma.carcasseIntermediaire.updateMany({
          where: { fei_numero: numero, deleted_at: null },
          data: { deleted_at, ...nextVersion(user.id) },
        }),
      ]);

      res.status(200).send({ ok: true, data: { deleted_at }, error: '' });
    }
  )
);

const adminFeiCorrectionsSchema = z.object({
  date_mise_a_mort: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide')
    .optional(),
  commune_mise_a_mort: z.string().trim().min(1, 'Commune vide').optional(),
  // l'examinateur ou un autre chasseur (par email), ou une association de chasse de l'examinateur
  premier_detenteur: z
    .union([
      z.object({ email: z.string().trim().toLowerCase().email('Email invalide') }),
      z.object({ entity_id: z.string().min(1) }),
    ])
    .optional(),
});

// Correction par l'admin des champs de base d'une fiche déjà transmise, que l'examinateur ne peut plus
// modifier dans l'app. Les champs recopiés sur les carcasses (date, premier détenteur) le sont aussi,
// comme mapFeiFieldsToCarcasse côté client et syncCarcasseDates côté serveur. `nextVersion` fait
// redescendre la correction par la synchro delta et rend périmée toute copie locale plus ancienne.
router.post(
  '/fei/:fei_numero/corrections',
  catchErrors(
    async (
      req: express.Request,
      res: express.Response<AdminFeiCorrectionResponse>,
      next: express.NextFunction
    ) => {
      const user = req.user as User;
      const numero = req.params.fei_numero;
      const result = adminFeiCorrectionsSchema.safeParse(req.body);
      if (!result.success) {
        res.status(400).send({ ok: false, data: null, error: result.error.issues[0].message });
        return;
      }
      const body = result.data;
      const { blocage } = await getAdminFeiCorrectionsBlocage(numero);
      if (blocage) {
        res.status(400).send({ ok: false, data: null, error: blocage });
        return;
      }
      const fei = await prisma.fei.findUniqueOrThrow({ where: { numero } });

      const feiData: Prisma.FeiUncheckedUpdateInput = {};
      const carcasseUpdates: Array<Prisma.CarcasseUpdateManyArgs> = [];
      const carcassesDeLaFiche: Prisma.CarcasseWhereInput = { fei_numero: numero, deleted_at: null };

      if (body.date_mise_a_mort) {
        const date_mise_a_mort = new Date(body.date_mise_a_mort);
        feiData.date_mise_a_mort = date_mise_a_mort;
        carcasseUpdates.push({ where: carcassesDeLaFiche, data: { date_mise_a_mort } });
      }
      if (body.commune_mise_a_mort) {
        feiData.commune_mise_a_mort = body.commune_mise_a_mort;
      }
      if (body.premier_detenteur) {
        let premierDetenteur: { user_id: string; entity_id: string | null; name: string };
        const choix = body.premier_detenteur;
        if ('entity_id' in choix) {
          const entityId = choix.entity_id;
          const association = (await getAssociationsDeChasse(fei.examinateur_initial_user_id)).find(
            (entity) => entity.id === entityId
          );
          if (!association || !fei.examinateur_initial_user_id) {
            res.status(400).send({
              ok: false,
              data: null,
              error: "L'examinateur n'est pas membre de cette association de chasse",
            });
            return;
          }
          // comme dans l'app : l'examinateur agit pour son association
          premierDetenteur = {
            user_id: fei.examinateur_initial_user_id,
            entity_id: association.id,
            name: association.nom_d_usage ?? '',
          };
        } else if ('email' in choix) {
          const chasseur = await prisma.user.findUnique({ where: { email: choix.email } });
          if (!chasseur || chasseur.deleted_at || !chasseur.roles.includes(UserRoles.CHASSEUR)) {
            res.status(400).send({ ok: false, data: null, error: 'Aucun chasseur avec cet email' });
            return;
          }
          premierDetenteur = {
            user_id: chasseur.id,
            entity_id: null,
            name: `${chasseur.prenom ?? ''} ${chasseur.nom_de_famille ?? ''}`.trim(),
          };
        }
        feiData.premier_detenteur_user_id = premierDetenteur.user_id;
        feiData.premier_detenteur_entity_id = premierDetenteur.entity_id;
        feiData.premier_detenteur_name_cache = premierDetenteur.name;
        carcasseUpdates.push({
          where: carcassesDeLaFiche,
          data: {
            premier_detenteur_user_id: premierDetenteur.user_id,
            premier_detenteur_entity_id: premierDetenteur.entity_id,
            premier_detenteur_name_cache: premierDetenteur.name,
          },
        });
        // fiche pas encore transmise par le premier détenteur : il est aussi le détenteur suivant ou actuel
        carcasseUpdates.push({
          where: { ...carcassesDeLaFiche, next_owner_role: FeiOwnerRole.PREMIER_DETENTEUR },
          data: {
            next_owner_user_id: premierDetenteur.user_id,
            next_owner_user_name_cache: premierDetenteur.name,
            next_owner_entity_id: premierDetenteur.entity_id,
            next_owner_entity_name_cache: premierDetenteur.entity_id ? premierDetenteur.name : null,
          },
        });
        carcasseUpdates.push({
          where: { ...carcassesDeLaFiche, current_owner_role: FeiOwnerRole.PREMIER_DETENTEUR },
          data: {
            current_owner_user_id: premierDetenteur.user_id,
            current_owner_user_name_cache: premierDetenteur.name,
            current_owner_entity_id: premierDetenteur.entity_id,
            current_owner_entity_name_cache: premierDetenteur.entity_id ? premierDetenteur.name : null,
          },
        });
      }

      if (Object.keys(feiData).length === 0) {
        res.status(400).send({ ok: false, data: null, error: 'Aucune correction demandée' });
        return;
      }

      const [savedFei] = await prisma.$transaction([
        prisma.fei.update({ where: { numero }, data: { ...feiData, ...nextVersion(user.id) } }),
        ...carcasseUpdates.map((update) =>
          prisma.carcasse.updateMany({ ...update, data: { ...update.data, ...nextVersion(user.id) } })
        ),
      ]);

      setAdminAuditChanges(res, fei, savedFei, Object.keys(feiData));
      res.status(200).send({ ok: true, data: null, error: '' });
    }
  )
);

const adminNewCarcasseSchema = z.object({
  numero_bracelet: z.string().trim().min(1, 'Numéro de marquage vide'),
  espece: z.string().trim().min(1, 'Espèce vide'),
  // la liste des espèces de petit gibier vit côté client (data/petit-gibier.json)
  type: z.enum([CarcasseType.GROS_GIBIER, CarcasseType.PETIT_GIBIER]),
  nombre_d_animaux: z.number().int().min(1).optional(),
});

// Ajout par l'admin d'une carcasse oubliée sur une fiche pas encore prise en charge par un intermédiaire.
// Elle reprend l'état de transmission d'une autre carcasse de la fiche (détenteur actuel et suivant,
// dépôt, transport) pour suivre le même chemin. Pas de notification : elle arrive par la synchro.
router.post(
  '/fei/:fei_numero/carcasse',
  catchErrors(
    async (
      req: express.Request,
      res: express.Response<AdminFeiCorrectionResponse>,
      next: express.NextFunction
    ) => {
      const user = req.user as User;
      const numero = req.params.fei_numero;
      const result = adminNewCarcasseSchema.safeParse(req.body);
      if (!result.success) {
        res.status(400).send({ ok: false, data: null, error: result.error.issues[0].message });
        return;
      }
      const body = result.data;
      const { ajoutCarcasseBlocage } = await getAdminFeiCorrectionsBlocage(numero);
      if (ajoutCarcasseBlocage) {
        res.status(400).send({ ok: false, data: null, error: ajoutCarcasseBlocage });
        return;
      }
      const fei = await prisma.fei.findUniqueOrThrow({ where: { numero } });
      const zacharie_carcasse_id = `${numero}_${body.numero_bracelet}`;
      const [carcasseModele, carcasseExistante] = await Promise.all([
        prisma.carcasse.findFirst({
          where: { fei_numero: numero, deleted_at: null },
          orderBy: { created_at: 'asc' },
        }),
        prisma.carcasse.findFirst({
          where: {
            OR: [{ zacharie_carcasse_id }, { fei_numero: numero, numero_bracelet: body.numero_bracelet }],
          },
          select: { deleted_at: true },
        }),
      ]);
      if (carcasseExistante) {
        res.status(400).send({
          ok: false,
          data: null,
          error: carcasseExistante.deleted_at
            ? 'Une carcasse supprimée porte déjà ce numéro de marquage sur cette fiche'
            : 'Le numéro de marquage est déjà utilisé pour cette fiche',
        });
        return;
      }
      if (!carcasseModele) {
        res.status(400).send({
          ok: false,
          data: null,
          error: "La fiche n'a aucune carcasse : l'examinateur peut l'ajouter lui-même",
        });
        return;
      }

      const carcasse = await prisma.carcasse.create({
        data: {
          zacharie_carcasse_id,
          fei_numero: numero,
          numero_bracelet: body.numero_bracelet,
          espece: body.espece,
          type: body.type,
          nombre_d_animaux: body.type === CarcasseType.PETIT_GIBIER ? (body.nombre_d_animaux ?? 1) : 1,
          date_mise_a_mort: fei.date_mise_a_mort,
          heure_mise_a_mort_premiere_carcasse_fei: fei.heure_mise_a_mort_premiere_carcasse,
          heure_evisceration_derniere_carcasse_fei: fei.heure_evisceration_derniere_carcasse,
          examinateur_anomalies_carcasse: [],
          examinateur_anomalies_abats: [],
          examinateur_signed_at: carcasseModele.examinateur_signed_at,
          examinateur_initial_offline: fei.examinateur_initial_offline,
          examinateur_initial_user_id: fei.examinateur_initial_user_id,
          examinateur_initial_approbation_mise_sur_le_marche:
            fei.examinateur_initial_approbation_mise_sur_le_marche,
          examinateur_initial_date_approbation_mise_sur_le_marche:
            fei.examinateur_initial_date_approbation_mise_sur_le_marche,
          premier_detenteur_offline: fei.premier_detenteur_offline,
          premier_detenteur_user_id: fei.premier_detenteur_user_id,
          premier_detenteur_entity_id: fei.premier_detenteur_entity_id,
          premier_detenteur_name_cache: fei.premier_detenteur_name_cache,
          premier_detenteur_depot_type: carcasseModele.premier_detenteur_depot_type,
          premier_detenteur_depot_entity_id: carcasseModele.premier_detenteur_depot_entity_id,
          premier_detenteur_depot_entity_name_cache: carcasseModele.premier_detenteur_depot_entity_name_cache,
          premier_detenteur_depot_ccg_at: carcasseModele.premier_detenteur_depot_ccg_at,
          premier_detenteur_transport_type: carcasseModele.premier_detenteur_transport_type,
          premier_detenteur_transport_date: carcasseModele.premier_detenteur_transport_date,
          premier_detenteur_prochain_detenteur_role_cache:
            carcasseModele.premier_detenteur_prochain_detenteur_role_cache,
          premier_detenteur_prochain_detenteur_id_cache:
            carcasseModele.premier_detenteur_prochain_detenteur_id_cache,
          svi_carcasse_status: CarcasseStatus.SANS_DECISION,
          svi_ipm1_pieces: [],
          svi_ipm1_lesions_ou_motifs: [],
          svi_ipm2_pieces: [],
          svi_ipm2_lesions_ou_motifs: [],
          svi_ipm2_traitement_assainissant: [],
          current_owner_role: carcasseModele.current_owner_role,
          current_owner_user_id: carcasseModele.current_owner_user_id,
          current_owner_user_name_cache: carcasseModele.current_owner_user_name_cache,
          current_owner_entity_id: carcasseModele.current_owner_entity_id,
          current_owner_entity_name_cache: carcasseModele.current_owner_entity_name_cache,
          next_owner_role: carcasseModele.next_owner_role,
          next_owner_user_id: carcasseModele.next_owner_user_id,
          next_owner_user_name_cache: carcasseModele.next_owner_user_name_cache,
          next_owner_entity_id: carcasseModele.next_owner_entity_id,
          next_owner_entity_name_cache: carcasseModele.next_owner_entity_name_cache,
          prev_owner_role: carcasseModele.prev_owner_role,
          prev_owner_user_id: carcasseModele.prev_owner_user_id,
          prev_owner_entity_id: carcasseModele.prev_owner_entity_id,
          created_by_user_id: user.id,
          version_user_id: user.id,
        },
      });

      setAdminAuditChanges(res, {}, carcasse, ['zacharie_carcasse_id', 'numero_bracelet', 'espece']);
      res.status(200).send({ ok: true, data: null, error: '' });
    }
  )
);

export default router;
