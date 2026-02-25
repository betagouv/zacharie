import type { Carcasse, CarcasseIntermediaire, Fei, Log } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import type { UserForFei } from '~/src/types/user';
import type { EntityWithUserRelation } from '~/src/types/entity';
import type { HistoryInput } from '@app/utils/create-history-entry';
import useZustandStore from '../store';

type CreateLog = {
  user_id: UserForFei['id'];
  user_role: string;
  action: string;
  history?: HistoryInput;
  fei_numero: Fei['numero'] | null;
  entity_id: EntityWithUserRelation['id'] | null;
  zacharie_carcasse_id: Carcasse['zacharie_carcasse_id'] | null;
  fei_intermediaire_id: CarcasseIntermediaire['intermediaire_id'] | null;
  intermediaire_id: CarcasseIntermediaire['intermediaire_id'] | null;
  carcasse_intermediaire_id: CarcasseIntermediaire['intermediaire_id'] | null;
};

export function addLog(newLog: Omit<CreateLog, 'fei_intermediaire_id'>): Log {
  const log = {
    id: uuidv4(),
    user_id: newLog.user_id!,
    user_role: newLog.user_role!,
    fei_numero: newLog.fei_numero || null,
    entity_id: newLog.entity_id || null,
    zacharie_carcasse_id: newLog.zacharie_carcasse_id || null,
    fei_intermediaire_id: newLog.intermediaire_id || null,
    intermediaire_id: newLog.intermediaire_id || null,
    carcasse_intermediaire_id: newLog.carcasse_intermediaire_id || null,
    action: newLog.action!,
    history: JSON.stringify(newLog.history!),
    date: dayjs().toDate(),
    is_synced: false,
    created_at: dayjs().toDate(),
    updated_at: dayjs().toDate(),
    deleted_at: null,
  };
  useZustandStore.setState((state) => ({
    ...state,
    logs: [...state.logs, log],
    dataIsSynced: false,
  }));
  return log;
}
