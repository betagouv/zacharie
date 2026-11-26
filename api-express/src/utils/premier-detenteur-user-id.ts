import { UserRelationType } from '@prisma/client';
import type { User } from '@prisma/client';
import prisma from '~/prisma';

// Les coordonnées (email, téléphone, adresse) du premier détenteur sont renvoyées à tous ceux qui
// voient la fiche (`GET /carcasse`) : on n'accepte donc pas un id utilisateur arbitraire du client,
// sinon on lit les coordonnées de n'importe qui en devinant des ids.
// Le premier détenteur personne physique est l'utilisateur lui-même, ou un chasseur qu'il a ajouté
// par son email (relation PREMIER_DETENTEUR, créée par `POST /user/fei/trouver-premier-detenteur`).
export async function isAllowedPremierDetenteurUserId(
  value: string | null | undefined,
  currentValues: Array<string | null | undefined>,
  user: User
): Promise<boolean> {
  if (!value) return true;
  if (value === user.id) return true;
  if (currentValues.includes(value)) return true;
  const relation = await prisma.userRelations.findFirst({
    where: { owner_id: user.id, related_id: value, relation: UserRelationType.PREMIER_DETENTEUR },
    select: { id: true },
  });
  return !!relation;
}
