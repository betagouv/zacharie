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
  est_forme_a_l_examen_initial: true,
  numero_cfei: true,
  created_at: true,
  updated_at: true,
} as const;

export type UserForFei = Prisma.UserGetPayload<{
  select: typeof userFeiSelect;
}>;

// Ce qu'un chasseur voit d'un propriétaire initial qu'il a cherché par email (ou ajouté à ses partenaires)
// tant qu'aucune fiche ne les relie : pas de téléphone, pas d'adresse. Les coordonnées arrivent avec
// les fiches (synchro des carcasses) une fois qu'il est désigné sur l'une d'elles.
export const userPartenaireSelect = {
  id: true,
  prenom: true,
  nom_de_famille: true,
  email: true,
  created_at: true,
  updated_at: true,
} as const;

export type UserPartenaire = Prisma.UserGetPayload<{
  select: typeof userPartenaireSelect;
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
