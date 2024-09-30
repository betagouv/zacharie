import { json, redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { getUserFromCookie } from "~/services/auth.server";
import { EntityTypes, EntityRelationType, UserRoles, UserRelationType } from "@prisma/client";
import { prisma } from "~/db/prisma.server";
import type { ExtractLoaderData } from "~/services/extract-loader-data";
import { getFeiByNumero, type FeiByNumero } from "~/db/fei.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await getUserFromCookie(request);
  if (!user) {
    throw redirect("/app/connexion?type=compte-existant");
  }
  const fei = (await getFeiByNumero(params.fei_numero as string)) as FeiByNumero;
  if (!fei) {
    throw redirect("/app/tableau-de-bord");
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
  const ccgs = allEntities.filter((entity) => entity.type === EntityTypes.CCG);
  const collecteursPro = allEntities.filter((entity) => entity.type === EntityTypes.COLLECTEUR_PRO);
  const etgs = allEntities.filter((entity) => entity.type === EntityTypes.ETG);
  const svis = allEntities.filter((entity) => entity.type === EntityTypes.SVI);

  return json({
    fei,
    detenteursInitiaux,
    examinateursInitiaux,
    ccgs,
    collecteursPro,
    etgs,
    svis,
    entitiesUserIsWorkingFor,
    latestVersion: __VITE_BUILD_ID__,
  });
}

export type FeiLoaderData = ExtractLoaderData<typeof loader>;
