import { type Carcasse, CarcasseType } from '@prisma/client';
import type { AnomaliePickerSection } from '@app/components/AnomaliePicker';
import { getReferentiel } from '@app/utils/anomalies-referentiel-data';
import { setCarcasseAnomalie } from '@app/utils/update-carcasse-anomalies';
import { canonicalOf, toggleAnomalie } from '@app/utils/anomalies-referentiel';

// Le groupe « Abats » est stocké dans examinateur_anomalies_abats,
// tout le reste (Comportement, Carcasse, Petit gibier) dans examinateur_anomalies_carcasse.
function isAbatsGroupe(groupe: string): boolean {
  return groupe === 'Abats';
}

// Construit les sections du picker depuis le référentiel + les tableaux sélectionnés,
// en branchant chaque section sur le bon setter (store ou state local).
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

    return {
      groupe: section.groupe,
      site: section.site,
      anomalies: section.anomalies,
      selected,
      onToggle: (canonical) => setValues(toggleAnomalie(storedValues, canonical)),
    };
  });
}

// Variante branchée sur le store, pour une carcasse existante (édition / synthèse).
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
