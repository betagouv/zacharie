import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { getUserFromCookie } from "~/services/auth.server";
import { EntityTypes, EntityRelationType, UserRoles, UserRelationType } from "@prisma/client";
import { prisma } from "~/db/prisma.server";
import type { ExtractLoaderData } from "~/services/extract-loader-data";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUserFromCookie(request);
  if (!user) {
    return json({ ok: false, data: null, error: "Unauthorized" }, { status: 401 });
  }
  const userEntitiesRelations = (
    await prisma.entityRelations.findMany({
      where: {
        owner_id: user.id,
        relation: EntityRelationType.WORKING_WITH,
      },
      include: {
        EntityRelatedWithUser: true,
      },
    })
  ).map((entityRelation) => ({ ...entityRelation.EntityRelatedWithUser, relation: entityRelation.relation }));

  const entitiesUserIsWorkingFor = (
    await prisma.entityRelations.findMany({
      where: {
        owner_id: user.id,
        relation: EntityRelationType.WORKING_FOR,
      },
      include: {
        EntityRelatedWithUser: true,
      },
    })
  ).map((entityRelation) => entityRelation.EntityRelatedWithUser);

  const svisOrEtgsCoupledIds = entitiesUserIsWorkingFor
    .filter((entity) => entity.type === EntityTypes.ETG || entity.type === EntityTypes.SVI)
    .map((etgOrSvi) => etgOrSvi.coupled_entity_id)
    .filter((id) => id !== null);

  const userCoupledEntities = (
    await prisma.entity.findMany({
      where: {
        id: {
          in: svisOrEtgsCoupledIds,
          notIn: entitiesUserIsWorkingFor.map((entity) => entity.id),
        },
      },
    })
  ).map((entity) => ({ ...entity, relation: EntityRelationType.WORKING_WITH }));

  const allOtherEntities = (
    await prisma.entity.findMany({
      where: {
        id: {
          notIn: [...userEntitiesRelations.map((entity) => entity.id), ...svisOrEtgsCoupledIds],
        },
        type: {
          not: EntityTypes.CCG, // les CCG doivent rester confidentiels contrairement aux ETG et SVI
        },
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
  });

  const detenteursInitiaux = userRelationsWithOtherUsers
    .filter((userRelation) => userRelation.relation === UserRelationType.PREMIER_DETENTEUR)
    .map((userRelation) => ({ ...userRelation.UserRelatedOfUserRelation, relation: userRelation.relation }));
  if (user.roles.includes(UserRoles.PREMIER_DETENTEUR)) {
    detenteursInitiaux.unshift({ ...user, relation: UserRelationType.PREMIER_DETENTEUR });
  }

  const examinateursInitiaux = userRelationsWithOtherUsers
    .filter((userRelation) => userRelation.relation === UserRelationType.EXAMINATEUR_INITIAL)
    .map((userRelation) => ({ ...userRelation.UserRelatedOfUserRelation, relation: userRelation.relation }));
  if (user.roles.includes(UserRoles.EXAMINATEUR_INITIAL)) {
    examinateursInitiaux.unshift({ ...user, relation: UserRelationType.EXAMINATEUR_INITIAL });
  }

  const allEntities = [...userEntitiesRelations, ...userCoupledEntities, ...allOtherEntities];
  const ccgs = userEntitiesRelations.filter((entity) => entity.type === EntityTypes.CCG);
  const myCollecteursPros = userEntitiesRelations.filter((entity) => entity.type === EntityTypes.COLLECTEUR_PRO);
  const collecteursPro = myCollecteursPros.length
    ? myCollecteursPros
    : allEntities.filter((entity) => entity.type === EntityTypes.COLLECTEUR_PRO);
  const myEtgs = [...userEntitiesRelations, ...userCoupledEntities].filter((entity) => entity.type === EntityTypes.ETG);
  const etgs = myEtgs.length ? myEtgs : allEntities.filter((entity) => entity.type === EntityTypes.ETG);
  const mySvis = [...userEntitiesRelations, ...userCoupledEntities].filter((entity) => entity.type === EntityTypes.SVI);
  const svis = mySvis.length ? mySvis : allEntities.filter((entity) => entity.type === EntityTypes.SVI);

  return json({
    ok: true,
    data: {
      user,
      detenteursInitiaux,
      examinateursInitiaux,
      ccgs,
      collecteursPro,
      etgs,
      svis,
      entitiesUserIsWorkingFor,
    },
    error: "",
  });
}

export type MyRelationsLoaderData = ExtractLoaderData<typeof loader>;
