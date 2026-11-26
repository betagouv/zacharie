import { type Carcasse, CarcasseType, UserRoles } from '@prisma/client';
import dayjs from 'dayjs';
import useZustandStore from '@app/zustand/store';
import useUser from '@app/zustand/user';
import { createHistoryInput } from '@app/utils/create-history-entry';
import { track } from '@app/services/matomo';
import type { AnomaliePickerAutres, AnomaliePickerSection } from '@app/components/AnomaliePicker';
import {
  canonicalOf,
  getReferentiel,
  lookupAnomalie,
  toggleAnomalie,
} from '@app/utils/anomalies-referentiel';

type AnomalieField = 'examinateur_anomalies_carcasse' | 'examinateur_anomalies_abats';

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
  track(
    'carcasse',
    'modifier-anomalie',
    nextValues.length > (carcasse[field] ?? []).length ? 'ajout' : 'retrait'
  );
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

function isAbatsGroupe(groupe: string): boolean {
  return groupe === 'Abats';
}

export function buildAnomaliePickerSections({
  isPetitGibier,
  anomaliesCarcasse,
  anomaliesAbats,
  setAnomaliesCarcasse,
  setAnomaliesAbats,
}: {
  isPetitGibier: boolean;
  anomaliesCarcasse: string[];
  anomaliesAbats: string[];
  setAnomaliesCarcasse: (next: string[]) => void;
  setAnomaliesAbats: (next: string[]) => void;
}): AnomaliePickerSection[] {
  const referentiel = getReferentiel(isPetitGibier);

  return referentiel.map((section) => {
    const abats = isAbatsGroupe(section.groupe);
    const storedValues = abats ? anomaliesAbats : anomaliesCarcasse;
    const setValues = abats ? setAnomaliesAbats : setAnomaliesCarcasse;

    const sectionCanonicals = new Set(section.anomalies.map((a) => canonicalOf(a.intitule, section.site)));
    const selected = storedValues.filter((c) => sectionCanonicals.has(c));

    const suffixe = section.site ? ` - ${section.site}` : null;
    const autres: AnomaliePickerAutres = {
      values: suffixe
        ? storedValues
            .filter((c) => c.endsWith(suffixe) && !sectionCanonicals.has(c))
            .map((c) => c.slice(0, -suffixe.length))
        : storedValues.filter((c) => !lookupAnomalie(c)),
      onAdd: (value) => setValues([...storedValues, canonicalOf(value, section.site)]),
      onRemove: (value) => setValues(storedValues.filter((c) => c !== canonicalOf(value, section.site))),
    };

    return {
      groupe: section.groupe,
      site: section.site,
      anomalies: section.anomalies,
      selected,
      onToggle: (canonical) => setValues(toggleAnomalie(storedValues, canonical)),
      champLibre: section.champ_libre,
      autres,
    };
  });
}

export function buildAutresAnomalies({
  isPetitGibier,
  anomaliesCarcasse,
  setAnomaliesCarcasse,
}: {
  isPetitGibier: boolean;
  anomaliesCarcasse: string[];
  setAnomaliesCarcasse: (next: string[]) => void;
}): AnomaliePickerAutres {
  const suffixes = getReferentiel(isPetitGibier)
    .map((section) => section.site)
    .filter(Boolean)
    .map((site) => ` - ${site}`);

  return {
    values: anomaliesCarcasse.filter(
      (canonical) => !lookupAnomalie(canonical) && !suffixes.some((s) => canonical.endsWith(s))
    ),
    onAdd: (value) => setAnomaliesCarcasse([...anomaliesCarcasse, value]),
    onRemove: (value) => setAnomaliesCarcasse(anomaliesCarcasse.filter((c) => c !== value)),
  };
}

export function buildCarcasseNavSections(carcasse: Carcasse): AnomaliePickerSection[] {
  return buildAnomaliePickerSections({
    isPetitGibier: carcasse.type === CarcasseType.PETIT_GIBIER,
    anomaliesCarcasse: carcasse.examinateur_anomalies_carcasse ?? [],
    anomaliesAbats: carcasse.examinateur_anomalies_abats ?? [],
    setAnomaliesCarcasse: (next) =>
      setCarcasseAnomalie({ carcasse, field: 'examinateur_anomalies_carcasse', nextValues: next }),
    setAnomaliesAbats: (next) =>
      setCarcasseAnomalie({ carcasse, field: 'examinateur_anomalies_abats', nextValues: next }),
  });
}

export function buildCarcasseAutresAnomalies(carcasse: Carcasse): AnomaliePickerAutres {
  return buildAutresAnomalies({
    isPetitGibier: carcasse.type === CarcasseType.PETIT_GIBIER,
    anomaliesCarcasse: carcasse.examinateur_anomalies_carcasse ?? [],
    setAnomaliesCarcasse: (next) =>
      setCarcasseAnomalie({ carcasse, field: 'examinateur_anomalies_carcasse', nextValues: next }),
  });
}
