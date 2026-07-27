import { type Carcasse, CarcasseType, UserRoles } from '@prisma/client';
import dayjs from 'dayjs';
import useZustandStore from '@app/zustand/store';
import useUser from '@app/zustand/user';
import { createHistoryInput } from '@app/utils/create-history-entry';
import type { AnomaliePickerAutres, AnomaliePickerSection } from '@app/components/AnomaliePicker';
import {
  canonicalOf,
  getReferentiel,
  lookupAnomalie,
  toggleAnomalie,
} from '@app/utils/anomalies-referentiel';

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

    // Saisie libre de la famille : stockée comme les autres, suffixée par le site
    // (« mon texte - Externe »), pour que l'aval sache de quel organe on parle. Le suffixe est
    // retiré à l'affichage, il n'apporte rien quand on est déjà dans la famille.
    const suffixe = section.site ? ` - ${section.site}` : null;
    const autres: AnomaliePickerAutres = {
      // Sans site (petit gibier, une seule famille) le suffixe ne discrimine rien :
      // ces valeurs relèvent du bloc global.
      values: suffixe
        ? storedValues
            .filter((c) => c.endsWith(suffixe) && !sectionCanonicals.has(c))
            .map((c) => c.slice(0, -suffixe.length))
        : [],
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

// Anomalies saisies en texte libre hors famille : les valeurs du tableau carcasse absentes du
// référentiel et non suffixées par une famille connue — celles-là s'affichent dans leur famille.
// Pas de préfixe ni de marqueur à maintenir, et une valeur devenue orpheline (référentiel modifié)
// reste visible et supprimable au lieu de disparaître.
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

export function buildCarcasseAutresAnomalies(carcasse: Carcasse): AnomaliePickerAutres {
  return buildAutresAnomalies({
    isPetitGibier: carcasse.type === CarcasseType.PETIT_GIBIER,
    anomaliesCarcasse: carcasse.examinateur_anomalies_carcasse ?? [],
    setAnomaliesCarcasse: (next) =>
      setCarcasseAnomalie({ carcasse, field: 'examinateur_anomalies_carcasse', nextValues: next }),
  });
}
