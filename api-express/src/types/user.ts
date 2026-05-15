import type { Prisma } from '@prisma/client';

export const userFeiSelect = {
  id: true,
  prenom: true,
  nom_de_famille: true,
  telephone: false,
  email: false,
  addresse_ligne_1: false,
  addresse_ligne_2: false,
  code_postal: true,
  ville: true,
  est_forme_a_l_examen_initial: true,
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
