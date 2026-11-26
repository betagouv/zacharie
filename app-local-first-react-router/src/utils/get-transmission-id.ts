import { CarcasseTransmission, CarcasseTransmissionWihMetadata } from '@app/types/carcasse';
import { Carcasse } from '@prisma/client';

export function getTransmissionId(
  transmission: Pick<CarcasseTransmission, 'fei_numero' | 'premier_detenteur_prochain_detenteur_id_cache'>
) {
  const numero = transmission.fei_numero!;
  const id = transmission.premier_detenteur_prochain_detenteur_id_cache!;
  return buildTransmissionId(numero, id);
}

export function buildTransmissionId(numero: string, id?: string) {
  if (id) return `${numero}__${id}`;
  return `${numero}__`;
}

export function getTransmissionIdFromMetadata(transmission: CarcasseTransmissionWihMetadata) {
  if (!transmission.content.premier_detenteur_prochain_detenteur_id_cache) {
    return buildTransmissionId(transmission.fei.numero);
  }
  return getTransmissionId(transmission.content);
}

export function getTransmissionLink(transmission: CarcasseTransmissionWihMetadata) {
  const numero = transmission.fei.numero;
  const id = transmission.content.premier_detenteur_prochain_detenteur_id_cache;
  if (id) return `${numero}/${id}`;
  return numero;
}

export function getTransmissionLinkFromCarcasse(carcasse: Carcasse) {
  const numero = carcasse.fei_numero;
  const id = carcasse.premier_detenteur_prochain_detenteur_id_cache;
  if (id) return `${numero}/${id}`;
  return numero;
}
