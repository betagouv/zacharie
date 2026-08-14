import { FeiOwnerRole } from '@prisma/client';

// Deux frontières distinctes, à ne pas confondre.
// Les deux acceptent aussi bien une Carcasse qu'un CarcasseTransmission (champs optionnels).

// « Un destinataire lui a été attribué » — elle ne doit plus entrer dans un lot de dispatch, sinon
// on la transmettrait deux fois. Le chasseur garde pourtant encore la main dessus : voir ci-dessous.
export function isCarcasseDejaEnvoyee(carcasse: {
  next_owner_entity_id?: string | null;
  current_owner_role?: FeiOwnerRole | null;
}) {
  if (carcasse.next_owner_entity_id != null) {
    return true;
  }
  return isCarcassePriseEnChargeEnAval(carcasse);
}

// « L'aval l'a réellement prise en charge » — le chasseur est dessaisi : plus d'édition, plus de
// suppression, et surtout son poste ne doit plus repousser cette carcasse au serveur.
// Choisir un destinataire ne suffit pas : tant que personne n'a pris en charge, le détenteur courant
// reste le chasseur et il peut encore corriger ou supprimer la carcasse (cf. canEdit, chasseur-fei.tsx).
export function isCarcassePriseEnChargeEnAval(carcasse: { current_owner_role?: FeiOwnerRole | null }) {
  if (carcasse.current_owner_role == null) {
    return false;
  }
  return (
    carcasse.current_owner_role !== FeiOwnerRole.PREMIER_DETENTEUR &&
    carcasse.current_owner_role !== FeiOwnerRole.EXAMINATEUR_INITIAL
  );
}
