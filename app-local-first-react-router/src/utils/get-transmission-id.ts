import { CarcasseTransmission } from '@app/types/carcasse';

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
  return buildTransmissionId(
    transmission.fei_numero!,
    transmission.premier_detenteur_prochain_detenteur_id_cache!
  );
}

export function buildTransmissionId(numero: string, id?: string) {
  return `${numero}__${id}`;
}
