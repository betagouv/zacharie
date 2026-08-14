import { FeiOwnerRole } from '@prisma/client';

// Une carcasse échappe au chasseur dès qu'elle a un destinataire, ou qu'elle a changé de détenteur.
// Les autres carcasses de la même fiche restent, elles, sous sa main : un lot peut partir sans les autres.
// Accepte aussi bien une Carcasse qu'un CarcasseTransmission (dont les champs sont optionnels).
export function isCarcasseDejaEnvoyee(carcasse: {
  next_owner_entity_id?: string | null;
  current_owner_role?: FeiOwnerRole | null;
}) {
  if (carcasse.next_owner_entity_id != null) {
    return true;
  }
  if (carcasse.current_owner_role == null) {
    return false;
  }
  return (
    carcasse.current_owner_role !== FeiOwnerRole.PREMIER_DETENTEUR &&
    carcasse.current_owner_role !== FeiOwnerRole.EXAMINATEUR_INITIAL
  );
}
