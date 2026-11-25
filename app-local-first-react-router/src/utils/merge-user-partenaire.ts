import type { UserForFei, UserPartenaire } from '@api/src/types/user';

export function mergeUserPartenaire(
  existing: UserForFei | undefined,
  partenaire: UserPartenaire
): UserForFei {
  return {
    telephone: null,
    addresse_ligne_1: null,
    addresse_ligne_2: null,
    code_postal: null,
    ville: null,
    est_forme_a_l_examen_initial: null,
    numero_cfei: null,
    ...existing,
    ...partenaire,
  };
}
