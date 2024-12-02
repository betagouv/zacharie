import type { Prisma } from '@prisma/client';

export const userFeiSelect = {
  id: true,
  prenom: true,
  nom_de_famille: true,
  telephone: true,
  email: true,
  addresse_ligne_1: true,
  addresse_ligne_2: true,
  code_postal: true,
  ville: true,
  numero_cfei: true,
} as const;

export type UserForFei = Prisma.UserGetPayload<{
  select: typeof userFeiSelect;
}>;

export const userAdminSelect = {
  id: true,
  email: true,
  nom_de_famille: true,
  prenom: true,
  code_postal: true,
  ville: true,
  roles: true,
} as const;

export type UserForAdmin = Prisma.UserGetPayload<{
  select: typeof userAdminSelect;
}>;
