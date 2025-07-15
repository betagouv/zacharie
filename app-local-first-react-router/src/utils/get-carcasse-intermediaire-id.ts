import { CarcasseForResponseForRegistry } from '@api/src/types/carcasse';
import { Carcasse, type CarcasseIntermediaire } from '@prisma/client';
import dayjs from 'dayjs';
import type {
  FeiIntermediaire,
  FeiAndIntermediaireIds,
  FeiAndCarcasseAndIntermediaireIds,
} from '@app/types/fei-intermediaire';

export function getNewCarcasseIntermediaireId(
  userId: string,
  feiNumero: string,
): CarcasseIntermediaire['intermediaire_id'] {
  return `${userId}_${feiNumero}_${dayjs().format('HHmmss')}`;
}

export function getFeiAndIntermediaireIds(
  carcasseIntermediaire: CarcasseIntermediaire,
): FeiAndIntermediaireIds {
  return `${carcasseIntermediaire.fei_numero}_${carcasseIntermediaire.intermediaire_id}`;
}

export function getFeiAndCarcasseAndIntermediaireIds(
  carcasseIntermediaire: CarcasseIntermediaire,
): FeiAndCarcasseAndIntermediaireIds {
  return `${carcasseIntermediaire.fei_numero}_${carcasseIntermediaire.zacharie_carcasse_id}_${carcasseIntermediaire.intermediaire_id}`;
}

export function getFeiAndCarcasseAndIntermediaireIdsFromCarcasse(
  carcasse: CarcasseForResponseForRegistry | Carcasse,
  intermediaireId: FeiIntermediaire['id'],
): FeiAndCarcasseAndIntermediaireIds {
  return `${carcasse.fei_numero}_${carcasse.zacharie_carcasse_id}_${intermediaireId}`;
}

export function getFeiAndIntermediaireIdsFromFeiIntermediaire(
  intermediaire: FeiIntermediaire,
): FeiAndIntermediaireIds {
  return `${intermediaire.fei_numero}_${intermediaire.id}`;
}
