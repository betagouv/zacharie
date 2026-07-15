import { type Carcasse, UserRoles } from '@prisma/client';
import dayjs from 'dayjs';
import useZustandStore from '@app/zustand/store';
import useUser from '@app/zustand/user';
import { createHistoryInput } from '@app/utils/create-history-entry';

type AnomalieField = 'examinateur_anomalies_carcasse' | 'examinateur_anomalies_abats';

// Écriture centralisée des anomalies d'une carcasse (carcasse ou abats).
// Met à jour le tableau ciblé, l'horodatage d'examen, recalcule le flag
// « sans anomalie » à partir des DEUX tableaux résultants, et journalise.
export function setCarcasseAnomalie({
  carcasse,
  field,
  nextValues,
}: {
  carcasse: Carcasse;
  field: AnomalieField;
  nextValues: string[];
}): void {
  const user = useUser.getState().user;
  if (!user?.id) return;

  const carcasseAnomalies =
    field === 'examinateur_anomalies_carcasse' ? nextValues : (carcasse.examinateur_anomalies_carcasse ?? []);
  const abatsAnomalies =
    field === 'examinateur_anomalies_abats' ? nextValues : (carcasse.examinateur_anomalies_abats ?? []);

  const partialCarcasse: Partial<Carcasse> = {
    [field]: nextValues,
    examinateur_signed_at: dayjs().toDate(),
    examinateur_carcasse_sans_anomalie: carcasseAnomalies.length === 0 && abatsAnomalies.length === 0,
  };

  const store = useZustandStore.getState();
  store.updateCarcasse(carcasse.zacharie_carcasse_id, partialCarcasse);
  store.addLog({
    user_id: user.id,
    user_role: UserRoles.CHASSEUR,
    fei_numero: carcasse.fei_numero,
    action: 'examinateur-carcasse-edit',
    history: createHistoryInput(carcasse, partialCarcasse),
    entity_id: null,
    zacharie_carcasse_id: carcasse.zacharie_carcasse_id,
    intermediaire_id: null,
    carcasse_intermediaire_id: null,
  });
}
