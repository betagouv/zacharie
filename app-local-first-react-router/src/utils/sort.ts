import { Carcasse } from '@prisma/client';

export function sortLatestFirstByCreatedAt<T extends { created_at: string }>(a: T, b: T) {
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

export function sortLatestFirstByUpdatedAt<T extends { updated_at: string }>(a: T, b: T) {
  return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
}

export function sortEarliestFirstByCreatedAt<T extends { created_at: string }>(a: T, b: T) {
  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
}

export function sortEarliestFirstByUpdatedAt<T extends { updated_at: string }>(a: T, b: T) {
  return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
}

export function sortCarcassesApproved(carcasseA: Carcasse, carcasseB: Carcasse) {
  if (carcasseA.intermediaire_carcasse_signed_at && carcasseB.intermediaire_carcasse_signed_at) {
    return (
      carcasseA.intermediaire_carcasse_signed_at.getTime() -
      carcasseB.intermediaire_carcasse_signed_at.getTime()
    );
  }
  if (carcasseA.espece === carcasseB.espece) {
    return carcasseA.numero_bracelet.localeCompare(carcasseB.numero_bracelet);
  }
  if (carcasseA.type === carcasseB.type) {
    return carcasseA.espece!.localeCompare(carcasseB.espece!);
  }
  return carcasseA.type!.localeCompare(carcasseB.type!);
}

export function sortCarcassesApprovedForExcel(carcasseA: Carcasse, carcasseB: Carcasse) {
  if (carcasseA.intermediaire_carcasse_signed_at && carcasseB.intermediaire_carcasse_signed_at) {
    return (
      carcasseA.intermediaire_carcasse_signed_at.getTime() -
      carcasseB.intermediaire_carcasse_signed_at.getTime()
    );
  }
  if (carcasseA.espece === carcasseB.espece) {
    return carcasseA.numero_bracelet.localeCompare(carcasseB.numero_bracelet);
  }
  if (carcasseA.type === carcasseB.type) {
    return carcasseA.espece!.localeCompare(carcasseB.espece!);
  }
  return carcasseA.type!.localeCompare(carcasseB.type!);
}
