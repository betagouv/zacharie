import { prisma } from "~/db/prisma.server";
import type { Prisma, Fei, Carcasse } from "@prisma/client";

export const carcasseInclude = {
  Fei: true,
} as const;

export type CarcasseWithRelations = Prisma.CarcasseGetPayload<{
  include: typeof carcasseInclude;
}>;
export type CarcasseByBracelet = CarcasseWithRelations | null;

export async function getCarcasseByBracelet(
  fei_numero: Fei["numero"],
  numero_bracelet: Carcasse["numero_bracelet"],
): Promise<CarcasseWithRelations | null> {
  const carcasse = await await prisma.carcasse.findUnique({
    where: {
      numero_bracelet: numero_bracelet,
      fei_numero: fei_numero,
    },
    include: carcasseInclude,
  });
  return carcasse;
}
