import { prisma } from "~/db/prisma.server";
import type { Prisma, Fei } from "@prisma/client";

export const feiInclude = {
  FeiCurrentEntity: true,
  FeiCurrentUser: true,
  FeiNextEntity: true,
  Carcasses: {
    orderBy: {
      numero_bracelet: "asc",
    },
  },
  FeiExaminateurInitialUser: true,
  FeiPremierDetenteurUser: true,
  FeiCreatedByUser: true,
  FeiDepotEntity: true,
  FeiSviEntity: true,
  FeiSviUser: true,
  FeiIntermediaires: {
    orderBy: {
      created_at: "desc", // the latest first
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
} as const;

export type FeiWithRelations = Prisma.FeiGetPayload<{
  include: typeof feiInclude;
}>;
export type FeiByNumero = FeiWithRelations | null;

export async function getFeiByNumero(fei_numero: Fei["numero"]): Promise<FeiByNumero> {
  const fei = await prisma.fei.findUnique({
    where: {
      numero: fei_numero,
    },
    include: feiInclude,
  });
  return fei;
}
