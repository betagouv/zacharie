import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { getUserFromCookie } from "~/services/auth.server";
import {
  type User,
  type Entity,
  type ETGAndEntityRelations,
  EntityTypes,
  EntityRelationType,
  UserRoles,
  UserRelationType,
} from "@prisma/client";
import { prisma } from "~/db/prisma.server";
import type { ExtractLoaderData } from "~/services/extract-loader-data";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUserFromCookie(request);
  if (!user) {
    return json({ ok: false, data: null, error: "Unauthorized" }, { status: 401 });
  }

  /*
  I need to fetch
  - the entities the user is working for (salarié, dirigeant, etc.)
  - teh entities working with the entities the user is working for (ETG, SVI, etc.)
  - the entities the user is working with (partnership)

  I need to return
  - the entities I work for, including the entities working with them (because it's LIKE I'm also working with them)
  - the entities I work with  (partnership confirmed)
  - the other entities I could work with (partnership not confirmed), which are all the rest

  */

  /* ENTITIES WORKING FOR */

  const entitiesWorkingDirectlyFor = await prisma.entityAndUserRelations
    .findMany({
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
    .then((entityRelations) => entityRelations.map((rel) => rel.EntityRelatedWithUser));

  const etgsRelatedWithMyEntities = await prisma.eTGAndEntityRelations.findMany({
    where: { entity_id: { in: entitiesWorkingDirectlyFor.map((entity) => entity.id) } },
    include: {
      ETGRelatedWithEntities: true,
    },
  });

  const svisRelatedWithMyETGs = await prisma.eTGAndEntityRelations.findMany({
    where: { etg_id: { in: entitiesWorkingDirectlyFor.map((entity) => entity.id) }, entity_type: EntityTypes.SVI },
    include: {
      EntitiesRelatedWithETG: true,
    },
  });

  const collecteursProsRelatedWithMyETGs = await prisma.eTGAndEntityRelations.findMany({
    where: {
      etg_id: { in: entitiesWorkingDirectlyFor.map((entity) => entity.id) },
      entity_type: EntityTypes.COLLECTEUR_PRO,
    },
    include: {
      EntitiesRelatedWithETG: true,
    },
  });

  const entitiesWorkingForObject: Record<string, Entity> = {};
  for (const entity of entitiesWorkingDirectlyFor) {
    entitiesWorkingForObject[entity.id] = entity;
  }
  for (const etg of etgsRelatedWithMyEntities.map((r) => r.ETGRelatedWithEntities)) {
    entitiesWorkingForObject[etg.id] = etg;
  }
  for (const svi of svisRelatedWithMyETGs.map((r) => r.EntitiesRelatedWithETG)) {
    entitiesWorkingForObject[svi.id] = svi;
  }
  for (const collecteurPro of collecteursProsRelatedWithMyETGs.map((r) => r.EntitiesRelatedWithETG)) {
    entitiesWorkingForObject[collecteurPro.id] = collecteurPro;
  }
  const entitiesWorkingFor = Object.values(entitiesWorkingForObject);

  const entitiesWorkingWith = (
    await prisma.entityAndUserRelations.findMany({
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

  const allOtherEntities = (
    await prisma.entity.findMany({
      where: {
        id: {
          notIn: [...entitiesWorkingFor.map((entity) => entity.id), ...entitiesWorkingWith.map((entity) => entity.id)],
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

  const allEntities = [
    ...entitiesWorkingWith.map((entity) => ({ ...entity, relation: EntityRelationType.WORKING_WITH })),
    ...allOtherEntities.map((entity) => ({ ...entity, relation: null })),
  ];

  const ccgs = entitiesWorkingWith.filter((entity) => entity.type === EntityTypes.CCG);
  const associationsDeChasse = entitiesWorkingDirectlyFor.filter(
    (entity) => entity.type === EntityTypes.PREMIER_DETENTEUR,
  );
  const collecteursPro = allEntities.filter((entity) => entity.type === EntityTypes.COLLECTEUR_PRO);
  const etgs = allEntities.filter((entity) => entity.type === EntityTypes.ETG);
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
      entitiesWorkingFor: entitiesWorkingDirectlyFor satisfies Array<Entity>,
      collecteursProsRelatedWithMyETGs: collecteursProsRelatedWithMyETGs satisfies Array<ETGAndEntityRelations>,
    },
    error: "",
  });
}

export type MyRelationsLoaderData = ExtractLoaderData<typeof loader>;
