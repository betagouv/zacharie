import { json, SerializeFrom, type LoaderFunctionArgs } from "@remix-run/node";
import { getUserFromCookie } from "~/services/auth.server";
import type { ExtractLoaderData } from "~/services/extract-loader-data";
import { prisma } from "~/db/prisma.server";
import { EntityRelationType, UserRoles, type Fei } from "@prisma/client";
import { formatCountCarcasseByEspece } from "~/utils/count-carcasses-by-espece";

(async () => {
  const allFeis = await prisma.fei.findMany({
    where: {
      deleted_at: null,
    },
    include: {
      Carcasses: true,
    },
  });

  for (const fei of allFeis) {
    await prisma.fei.update({
      where: {
        numero: fei.numero,
      },
      data: {
        resume_nombre_de_carcasses: formatCountCarcasseByEspece(fei.Carcasses).join("\n"),
      },
    });
  }
})();

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUserFromCookie(request);

  if (!user?.onboarded_at) {
    return json(
      {
        user: null,
        feisUnderMyResponsability: [],
        feisToTake: [],
        feisOngoing: [],
        feisDone: [],
        feisOngoingForMyEntities: [],
      },
      {
        status: 401,
      },
    );
  }
  const feisUnderMyResponsability = await prisma.fei.findMany({
    where: {
      svi_assigned_at: null,
      deleted_at: null,
      svi_signed_at: null,
      fei_next_owner_user_id: null,
      fei_next_owner_entity_id: null,
      OR: [
        {
          fei_current_owner_user_id: user.id,
        },
        {
          FeiCurrentEntity: {
            EntityRelatedWithUser: {
              some: {
                owner_id: user.id,
                relation: EntityRelationType.WORKING_FOR,
              },
            },
          },
        },
        {
          AND: [
            {
              fei_current_owner_role: UserRoles.ETG,
            },
            {
              FeiCurrentEntity: {
                EntityRelatedWithETG: {
                  some: {
                    EntityRelatedWithETG: {
                      EntityRelatedWithUser: {
                        some: {
                          owner_id: user.id,
                          relation: EntityRelationType.WORKING_FOR,
                        },
                      },
                    },
                  },
                },
              },
            },
          ],
        },
        {
          AND: [
            {
              fei_next_owner_role: UserRoles.COLLECTEUR_PRO,
            },
            {
              FeiNextEntity: {
                ETGRelatedWithEntity: {
                  some: {
                    ETGRelatedWithEntity: {
                      EntityRelatedWithUser: {
                        some: {
                          owner_id: user.id,
                          relation: EntityRelationType.WORKING_FOR,
                        },
                      },
                    },
                  },
                },
              },
            },
          ],
        },
      ],
    },
    orderBy: {
      updated_at: "desc",
    },
  });

  const feisToTake = await prisma.fei.findMany({
    where: {
      svi_assigned_at: null,
      deleted_at: null,
      OR: [
        {
          fei_next_owner_user_id: user.id,
        },
        {
          FeiNextEntity: {
            EntityRelatedWithUser: {
              some: {
                owner_id: user.id,
                relation: EntityRelationType.WORKING_FOR,
              },
            },
          },
        },
        {
          AND: [
            {
              fei_next_owner_role: UserRoles.ETG,
            },
            {
              FeiNextEntity: {
                EntityRelatedWithETG: {
                  some: {
                    EntityRelatedWithETG: {
                      EntityRelatedWithUser: {
                        some: {
                          owner_id: user.id,
                          relation: EntityRelationType.WORKING_FOR,
                        },
                      },
                    },
                  },
                },
              },
            },
          ],
        },
        {
          AND: [
            {
              fei_next_owner_role: UserRoles.COLLECTEUR_PRO,
            },
            {
              FeiNextEntity: {
                ETGRelatedWithEntity: {
                  some: {
                    ETGRelatedWithEntity: {
                      EntityRelatedWithUser: {
                        some: {
                          owner_id: user.id,
                          relation: EntityRelationType.WORKING_FOR,
                        },
                      },
                    },
                  },
                },
              },
            },
          ],
        },
      ],
    },
    orderBy: {
      updated_at: "desc",
    },
  });

  const feisOngoing = await prisma.fei.findMany({
    where: {
      svi_assigned_at: null,
      deleted_at: null,
      // fei_current_owner_user_id: { not: user.id },
      AND: [
        {
          AND: [
            {
              fei_next_owner_user_id: { not: user.id },
            },
            {
              fei_next_owner_user_id: { not: null },
            },
          ],
        },
        {
          OR: [
            { fei_next_owner_entity_id: null },
            {
              FeiNextEntity: {
                EntityRelatedWithUser: {
                  none: {
                    owner_id: user.id,
                    relation: EntityRelationType.WORKING_FOR,
                  },
                },
              },
            },
          ],
        },
        {
          OR: [
            {
              examinateur_initial_user_id: user.id,
            },
            {
              premier_detenteur_user_id: user.id,
            },
            {
              FeiPremierDetenteurEntity: {
                EntityRelatedWithUser: {
                  some: {
                    owner_id: user.id,
                    relation: EntityRelationType.WORKING_FOR,
                  },
                },
              },
            },
            {
              FeiIntermediaires: {
                some: {
                  fei_intermediaire_user_id: user.id,
                },
              },
            },
            {
              FeiIntermediaires: {
                some: {
                  FeiIntermediaireEntity: {
                    EntityRelatedWithUser: {
                      some: {
                        owner_id: user.id,
                        relation: EntityRelationType.WORKING_FOR,
                      },
                    },
                  },
                },
              },
            },
          ],
        },
      ],
    },
    orderBy: {
      updated_at: "desc",
    },
  });

  const feisOngoingForMyEntities = await prisma.fei.findMany({
    where: {
      svi_assigned_at: null,
      deleted_at: null,
      OR: [
        {
          FeiCurrentEntity: {
            EntityRelatedWithUser: {
              some: {
                owner_id: user.id,
                relation: EntityRelationType.WORKING_FOR,
              },
            },
          },
        },
        {
          FeiPremierDetenteurEntity: {
            EntityRelatedWithUser: {
              some: {
                owner_id: user.id,
                relation: EntityRelationType.WORKING_FOR,
              },
            },
          },
        },
        {
          FeiNextEntity: {
            EntityRelatedWithUser: {
              some: {
                owner_id: user.id,
                relation: EntityRelationType.WORKING_FOR,
              },
            },
          },
        },
      ],
    },
    orderBy: {
      updated_at: "desc",
    },
  });
  // console.log("feisUnderMyResponsability", feisUnderMyResponsability.length);
  // console.log("feisToTake", feisToTake.length);
  // console.log("feisOngoing", feisOngoing.length);

  return json({
    user,
    feisUnderMyResponsability: JSON.parse(JSON.stringify(feisUnderMyResponsability)) as SerializeFrom<Array<Fei>>,
    feisToTake: JSON.parse(JSON.stringify(feisToTake)) as SerializeFrom<Array<Fei>>,
    feisOngoing: JSON.parse(JSON.stringify(feisOngoing)) as SerializeFrom<Array<Fei>>,
    feisOngoingForMyEntities: JSON.parse(JSON.stringify(feisOngoingForMyEntities)) as SerializeFrom<Array<Fei>>,
  });
}

export type FeisLoaderData = ExtractLoaderData<typeof loader>;
