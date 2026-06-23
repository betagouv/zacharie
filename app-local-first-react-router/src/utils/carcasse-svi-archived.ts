import { Carcasse } from '@prisma/client';
import dayjs from 'dayjs';

export function isCarcasseSviArchived(carcasse: Carcasse) {
  return !!carcasse.svi_closed_at || dayjs().diff(carcasse.svi_assigned_at, 'day') > 10;
}
