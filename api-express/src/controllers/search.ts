import express from 'express';
import passport from 'passport';
import { catchErrors } from '~/middlewares/errors';
const router: express.Router = express.Router();
import prisma from '~/prisma';
import type { SearchResponse } from '~/types/responses';
import dayjs from 'dayjs';
import { RequestWithUser } from '~/types/request';
import { UserRoles } from '@prisma/client';

/**
 * Search handler for SVI users
 */
async function handleSviSearch(searchQuery: string, userId: string): Promise<SearchResponse> {
  // Build FEI filter for SVI
  const svi_entity_id = await prisma.entityAndUserRelations
    .findFirst({
      where: {
        deleted_at: null,
        owner_id: userId,
        EntityRelatedWithUser: {
          type: UserRoles.SVI,
        },
      },
    })
    .then((relation) => relation?.entity_id);

  const feiWhereFilter: any = {
    deleted_at: null,
    svi_entity_id,
    svi_assigned_at: {
      gte: dayjs().subtract(2, 'months').toDate(),
    },
  };

  // Search by carcasse numero_bracelet
  const carcasses = await prisma.carcasse.findMany({
    where: {
      numero_bracelet: searchQuery,
      deleted_at: null,
      intermediaire_carcasse_refus_intermediaire_id: null,
      OR: [
        {
          intermediaire_carcasse_manquante: false,
        },
        {
          intermediaire_carcasse_manquante: null,
        },
      ],
      Fei: feiWhereFilter,
    },
    include: {
      Fei: {
        select: {
          numero: true,
          date_mise_a_mort: true,
          commune_mise_a_mort: true,
          svi_entity_id: true,
          svi_assigned_at: true,
        },
      },
    },
  });

  if (carcasses?.length) {
    return {
      ok: true,
      data: carcasses.map((carcasse) => ({
        searchQuery,
        redirectUrl: `/app/tableau-de-bord/carcasse-svi/${carcasse.fei_numero}/${carcasse.zacharie_carcasse_id}`,
        carcasse_numero_bracelet: carcasse.numero_bracelet,
        carcasse_espece: carcasse.espece || '',
        carcasse_type: carcasse.type,
        fei_numero: carcasse.fei_numero,
        fei_date_mise_a_mort: dayjs(carcasse.Fei.date_mise_a_mort).format('DD/MM/YYYY'),
        fei_svi_assigned_at: carcasse.Fei.svi_assigned_at
          ? dayjs(carcasse.Fei.svi_assigned_at).format('DD/MM/YYYY')
          : '',
        fei_commune_mise_a_mort: carcasse.Fei.commune_mise_a_mort!,
      })),
      error: '',
    };
  }

  // Search by carcasseIntermediaire commentaire
  const carcasseIntermediaires = await prisma.carcasseIntermediaire.findMany({
    where: {
      commentaire: {
        contains: searchQuery,
      },
    },
  });

  if (carcasseIntermediaires.length) {
    const foundCarcasses = [];
    for (const carcasseIntermediaire of carcasseIntermediaires) {
      const carcassesFound = await prisma.carcasse.findMany({
        where: {
          numero_bracelet: carcasseIntermediaire.numero_bracelet,
          Fei: feiWhereFilter,
        },
        include: {
          Fei: {
            select: {
              numero: true,
              date_mise_a_mort: true,
              commune_mise_a_mort: true,
              svi_entity_id: true,
              svi_assigned_at: true,
            },
          },
        },
      });
      if (carcassesFound) {
        foundCarcasses.push(...carcassesFound);
      }
    }
    if (foundCarcasses.length) {
      return {
        ok: true,
        data: foundCarcasses.map((carcasse) => ({
          searchQuery,
          redirectUrl: `/app/tableau-de-bord/carcasse-svi/${carcasse.fei_numero}/${carcasse.zacharie_carcasse_id}`,
          carcasse_numero_bracelet: carcasse.numero_bracelet,
          carcasse_espece: carcasse.espece || '',
          carcasse_type: carcasse.type,
          fei_numero: carcasse.fei_numero,
          fei_date_mise_a_mort: dayjs(carcasse.Fei.date_mise_a_mort).format('DD/MM/YYYY'),
          fei_svi_assigned_at: carcasse.Fei.svi_assigned_at
            ? dayjs(carcasse.Fei.svi_assigned_at).format('DD/MM/YYYY')
            : '',
          fei_commune_mise_a_mort: carcasse.Fei.commune_mise_a_mort!,
        })),
        error: '',
      };
    }
  }

  // Search by FEI numero
  const feis = await prisma.fei.findMany({
    where: {
      numero: {
        contains: searchQuery,
      },
      ...feiWhereFilter,
    },
  });

  if (feis.length) {
    return {
      ok: true,
      data: feis.map((fei) => ({
        searchQuery,
        redirectUrl: `/app/tableau-de-bord/fei/${fei.numero}`,
        carcasse_numero_bracelet: '',
        carcasse_espece: '',
        carcasse_type: '',
        fei_numero: fei.numero,
        fei_date_mise_a_mort: dayjs(fei.date_mise_a_mort).format('DD/MM/YYYY'),
        fei_svi_assigned_at: fei.svi_assigned_at ? dayjs(fei.svi_assigned_at).format('DD/MM/YYYY') : '',
        fei_commune_mise_a_mort: fei.commune_mise_a_mort!,
      })),
      error: '',
    };
  }

  return {
    ok: true,
    data: [],
    error: 'Aucun élément ne correspond à votre recherche',
  };
}

/**
 * Search handler for CHASSEUR users (default)
 */
async function handleChasseurSearch(searchQuery: string, userId: string): Promise<SearchResponse> {
  // Build FEI filter for CHASSEUR
  const feiWhereFilter: any = {
    deleted_at: null,
    OR: [
      {
        examinateur_initial_user_id: userId,
      },
      {
        premier_detenteur_user_id: userId,
      },
    ],
  };

  // Search by carcasse numero_bracelet
  const carcasses = await prisma.carcasse.findMany({
    where: {
      numero_bracelet: searchQuery,
      deleted_at: null,
      intermediaire_carcasse_refus_intermediaire_id: null,
      OR: [
        {
          intermediaire_carcasse_manquante: false,
        },
        {
          intermediaire_carcasse_manquante: null,
        },
      ],
      Fei: feiWhereFilter,
    },
    include: {
      Fei: {
        select: {
          numero: true,
          date_mise_a_mort: true,
          commune_mise_a_mort: true,
          svi_entity_id: true,
          svi_assigned_at: true,
        },
      },
    },
  });

  if (carcasses?.length) {
    return {
      ok: true,
      data: carcasses.map((carcasse) => ({
        searchQuery,
        redirectUrl: `/app/tableau-de-bord/fei/${carcasse.fei_numero}`,
        carcasse_numero_bracelet: carcasse.numero_bracelet,
        carcasse_espece: carcasse.espece || '',
        carcasse_type: carcasse.type,
        fei_numero: carcasse.fei_numero,
        fei_date_mise_a_mort: dayjs(carcasse.Fei.date_mise_a_mort).format('DD/MM/YYYY'),
        fei_svi_assigned_at: carcasse.Fei.svi_assigned_at
          ? dayjs(carcasse.Fei.svi_assigned_at).format('DD/MM/YYYY')
          : '',
        fei_commune_mise_a_mort: carcasse.Fei.commune_mise_a_mort!,
      })),
      error: '',
    };
  }

  // Search by carcasseIntermediaire commentaire
  const carcasseIntermediaires = await prisma.carcasseIntermediaire.findMany({
    where: {
      commentaire: {
        contains: searchQuery,
      },
    },
  });

  if (carcasseIntermediaires.length) {
    const foundCarcasses = [];
    for (const carcasseIntermediaire of carcasseIntermediaires) {
      const carcassesFound = await prisma.carcasse.findMany({
        where: {
          numero_bracelet: carcasseIntermediaire.numero_bracelet,
          Fei: feiWhereFilter,
        },
        include: {
          Fei: {
            select: {
              numero: true,
              date_mise_a_mort: true,
              commune_mise_a_mort: true,
              svi_entity_id: true,
              svi_assigned_at: true,
            },
          },
        },
      });
      if (carcassesFound) {
        foundCarcasses.push(...carcassesFound);
      }
    }
    if (foundCarcasses.length) {
      return {
        ok: true,
        data: foundCarcasses.map((carcasse) => ({
          searchQuery,
          redirectUrl: `/app/tableau-de-bord/fei/${carcasse.fei_numero}`,
          carcasse_numero_bracelet: carcasse.numero_bracelet,
          carcasse_espece: carcasse.espece || '',
          carcasse_type: carcasse.type,
          fei_numero: carcasse.fei_numero,
          fei_date_mise_a_mort: dayjs(carcasse.Fei.date_mise_a_mort).format('DD/MM/YYYY'),
          fei_svi_assigned_at: carcasse.Fei.svi_assigned_at
            ? dayjs(carcasse.Fei.svi_assigned_at).format('DD/MM/YYYY')
            : '',
          fei_commune_mise_a_mort: carcasse.Fei.commune_mise_a_mort!,
        })),
        error: '',
      };
    }
  }

  // Search by FEI numero
  const feis = await prisma.fei.findMany({
    where: {
      numero: {
        contains: searchQuery,
      },
      ...feiWhereFilter,
    },
  });

  if (feis.length) {
    return {
      ok: true,
      data: feis.map((fei) => ({
        searchQuery,
        redirectUrl: `/app/tableau-de-bord/fei/${fei.numero}`,
        carcasse_numero_bracelet: '',
        carcasse_espece: '',
        carcasse_type: '',
        fei_numero: fei.numero,
        fei_date_mise_a_mort: dayjs(fei.date_mise_a_mort).format('DD/MM/YYYY'),
        fei_svi_assigned_at: fei.svi_assigned_at ? dayjs(fei.svi_assigned_at).format('DD/MM/YYYY') : '',
        fei_commune_mise_a_mort: fei.commune_mise_a_mort!,
      })),
      error: '',
    };
  }

  return {
    ok: true,
    data: [],
    error: 'Aucun élément ne correspond à votre recherche',
  };
}

router.get(
  '/',
  passport.authenticate('user', { session: false }),
  catchErrors(async (req: RequestWithUser, res: express.Response, next: express.NextFunction) => {
    const searchQuery = req.query.q as string;
    const user = req.user!;

    if (!searchQuery) {
      res.status(200).send({ ok: false, data: [], error: '' });
      return;
    }

    if (![UserRoles.SVI, UserRoles.CHASSEUR].some((role) => user.roles.includes(role))) {
      res.status(200).send({ ok: false, data: [], error: '' });
      return;
    }

    // Route to appropriate handler based on user role
    let result: SearchResponse;
    switch (true) {
      case user.roles.includes(UserRoles.SVI):
        result = await handleSviSearch(searchQuery, user.id);
        break;
      case user.roles.includes(UserRoles.CHASSEUR):
      default:
        result = await handleChasseurSearch(searchQuery, user.id);
        break;
    }

    res.status(200).send(result);
  }),
);

export default router;
