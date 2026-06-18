import { CarcasseTransmission, CarcasseTransmissionWihMetadata } from '@app/types/carcasse';
import { Carcasse } from '@prisma/client';

// parce qu'un Premier Détenteur peut
// dispatcher ses carcasses d'une même Fei
// à destination de plusieurs Prochains Détenteurs
// chaque "groupe de carcasse" a ensuite un cycle de vie différent
// toutefois, elles peuvent se retrouver chez le même SVI,
// voire chez le même Destinataire après un trajet différent
// il faut donc un autre moyen de les discriminer selon un identifiant unique : le voici
export function getTransmissionId(
  transmission: Pick<CarcasseTransmission, 'fei_numero' | 'premier_detenteur_prochain_detenteur_id_cache'>
) {
  const numero = transmission.fei_numero!;
  const id = transmission.premier_detenteur_prochain_detenteur_id_cache!;
  return buildTransmissionId(numero, id);
}

export function buildTransmissionId(numero: string, id?: string) {
  return `${numero}__${id}`;
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
