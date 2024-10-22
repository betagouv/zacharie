import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { getUserFromCookie } from "~/services/auth.server";
import { type User, type Entity, EntityTypes, EntityRelationType, UserRoles, UserRelationType } from "@prisma/client";
import { prisma } from "~/db/prisma.server";
import type { ExtractLoaderData } from "~/services/extract-loader-data";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUserFromCookie(request);
  if (!user) {
    return json({ ok: false, data: null, error: "Unauthorized" }, { status: 401 });
  }
  const entitiesWorkingWith = (
    await prisma.entityRelations.findMany({
      where: {
        owner_id: user.id,
        relation: EntityRelationType.WORKING_WITH,
      },
      include: {
        EntityRelatedWithUser: true,
      },
      orderBy: {
        updated_at: "desc",
      },
    })
  ).map((entityRelation) => ({ ...entityRelation.EntityRelatedWithUser, relation: entityRelation.relation }));

  const entitiesWorkingFor = (
    await prisma.entityRelations.findMany({
      where: {
        owner_id: user.id,
        relation: EntityRelationType.WORKING_FOR,
      },
      include: {
        EntityRelatedWithUser: true,
      },
      orderBy: {
        updated_at: "desc",
      },
    })
  ).map((entityRelation) => entityRelation.EntityRelatedWithUser);

  const svisOrEtgsCoupledIds = entitiesWorkingFor
    .filter((entity) => entity.type === EntityTypes.ETG || entity.type === EntityTypes.SVI)
    .map((etgOrSvi) => etgOrSvi.coupled_entity_id)
    .filter((id) => id !== null);

  const userCoupledEntities = (
    await prisma.entity.findMany({
      where: {
        id: {
          in: svisOrEtgsCoupledIds,
          notIn: entitiesWorkingFor.map((entity) => entity.id),
        },
      },
      orderBy: {
        updated_at: "desc",
      },
    })
  ).map((entity) => ({ ...entity, relation: EntityRelationType.WORKING_WITH }));

  const allOtherEntities = (
    await prisma.entity.findMany({
      where: {
        id: {
          notIn: entitiesWorkingWith.map((entity) => entity.id),
        },
        type: {
          not: EntityTypes.CCG, // les CCG doivent rester confidentiels contrairement aux ETG et SVI
        },
      },
      orderBy: {
        updated_at: "desc",
      },
    })
  ).map((entity) => ({ ...entity, relation: null }));

  const userRelationsWithOtherUsers = await prisma.userRelations.findMany({
    where: {
      owner_id: user.id,
    },
    include: {
      UserRelatedOfUserRelation: true,
    },
    orderBy: {
      updated_at: "desc",
    },
  });

  const detenteursInitiaux = userRelationsWithOtherUsers
    .filter((userRelation) => userRelation.relation === UserRelationType.PREMIER_DETENTEUR)
    .map((userRelation) => ({ ...userRelation.UserRelatedOfUserRelation, relation: userRelation.relation }));
  if (user.roles.includes(UserRoles.PREMIER_DETENTEUR)) {
    detenteursInitiaux.unshift({ ...user, relation: UserRelationType.PREMIER_DETENTEUR });
  }

  // const examinateursInitiaux = userRelationsWithOtherUsers
  //   .filter((userRelation) => userRelation.relation === UserRelationType.EXAMINATEUR_INITIAL)
  //   .map((userRelation) => ({ ...userRelation.UserRelatedOfUserRelation, relation: userRelation.relation }));
  // if (user.roles.includes(UserRoles.EXAMINATEUR_INITIAL)) {
  //   examinateursInitiaux.unshift({ ...user, relation: UserRelationType.EXAMINATEUR_INITIAL });
  // }

  const allEntities = [...entitiesWorkingWith, ...userCoupledEntities, ...allOtherEntities];

  const ccgs = entitiesWorkingWith.filter((entity) => entity.type === EntityTypes.CCG);
  const associationsDeChasse = entitiesWorkingFor.filter((entity) => entity.type === EntityTypes.PREMIER_DETENTEUR);
  // const myCollecteursPros = entitiesWorkingWith.filter((entity) => entity.type === EntityTypes.COLLECTEUR_PRO);
  // const collecteursPro = myCollecteursPros.length
  //   ? myCollecteursPros
  //   : allEntities.filter((entity) => entity.type === EntityTypes.COLLECTEUR_PRO);
  const collecteursPro = allEntities.filter((entity) => entity.type === EntityTypes.COLLECTEUR_PRO);
  // const myEtgs = [...entitiesWorkingWith, ...userCoupledEntities].filter((entity) => entity.type === EntityTypes.ETG);
  // const etgs = myEtgs.length ? myEtgs : allEntities.filter((entity) => entity.type === EntityTypes.ETG);
  const etgs = allEntities.filter((entity) => entity.type === EntityTypes.ETG);
  // const mySvis = [...entitiesWorkingWith, ...userCoupledEntities].filter((entity) => entity.type === EntityTypes.SVI);
  // const svis = mySvis.length ? mySvis : allEntities.filter((entity) => entity.type === EntityTypes.SVI);
  const svis = allEntities.filter((entity) => entity.type === EntityTypes.SVI);

  return json({
    ok: true,
    data: {
      user: user satisfies User,
      detenteursInitiaux: detenteursInitiaux satisfies Array<User>,
      // examinateursInitiaux: examinateursInitiaux satisfies Array<User>,
      associationsDeChasse: associationsDeChasse satisfies Array<Entity>,
      ccgs: ccgs satisfies Array<Entity>,
      collecteursPro: collecteursPro satisfies Array<Entity>,
      etgs: etgs satisfies Array<Entity>,
      svis: svis satisfies Array<Entity>,
      entitiesWorkingFor: entitiesWorkingFor satisfies Array<Entity>,
    },
    error: "",
  });
}

export type MyRelationsLoaderData = ExtractLoaderData<typeof loader>;
