import type { User } from '@prisma/client';

export function getChasseurDealName(chasseur: Pick<User, 'prenom' | 'nom_de_famille' | 'email'>): string {
  const name = [chasseur.prenom, chasseur.nom_de_famille]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ');
  return name || chasseur.email;
}
