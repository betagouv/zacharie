import { prisma } from "~/db/prisma.server";
import type { Prisma, Fei } from "@prisma/client";

type FeiWithRelations = Prisma.FeiGetPayload<{
  include: {
    FeiCurrentEntity: true;
    FeiCurrentUser: true;
    FeiNextEntity: true;
    Carcasses: true;
    FeiDetenteurInitialUser: true;
    FeiExaminateurInitialUser: true;
    FeiCreatedByUser: true;
    FeiDepotEntity: true;
    FeiSviEntity: true;
    FeiSviUser: true;
    FeiIntermediaires: {
      include: {
        CarcasseIntermediaire: true;
        FeiIntermediaireEntity: {
          select: {
            raison_sociale: true;
            siret: true;
            type: true;
            numero_ddecpp: true;
            address_ligne_1: true;
            address_ligne_2: true;
            code_postal: true;
            ville: true;
          };
        };
        FeiIntermediaireUser: {
          select: {
            nom_de_famille: true;
            prenom: true;
            email: true;
            telephone: true;
          };
        };
      };
    };
  };
}>;

export async function getFeiByNumero(fei_numero: Fei["numero"]): Promise<Fei | null> {
  const fei = await prisma.fei.findUnique({
    where: {
      numero: fei_numero,
    },
    include: {
      FeiCurrentEntity: true,
      FeiCurrentUser: true,
      FeiNextEntity: true,
      Carcasses: {
        orderBy: {
          numero_bracelet: "asc",
        },
      },
      FeiDetenteurInitialUser: true,
      FeiExaminateurInitialUser: true,
      FeiCreatedByUser: true,
      FeiDepotEntity: true,
      FeiSviEntity: true,
      FeiSviUser: true,
      FeiIntermediaires: {
        orderBy: {
          created_at: "desc", // the lastest first
        },
        include: {
          CarcasseIntermediaire: true,
          FeiIntermediaireEntity: {
            select: {
              raison_sociale: true,
              siret: true,
              type: true,
              numero_ddecpp: true,
              address_ligne_1: true,
              address_ligne_2: true,
              code_postal: true,
              ville: true,
            },
          },
          FeiIntermediaireUser: {
            select: {
              nom_de_famille: true,
              prenom: true,
              email: true,
              telephone: true,
            },
          },
        },
      },
    },
  });
  return fei;
}

export type FeiByNumero = FeiWithRelations | null;