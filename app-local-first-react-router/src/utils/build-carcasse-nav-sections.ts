import { CarcasseType } from '@prisma/client';
import type { CarcasseWithModificationRequests } from '@api/src/types/carcasse';
import grandGibierCarcasseTree from '@app/data/grand-gibier-carcasse/tree.json';
import petitGibierCarcasseTree from '@app/data/petit-gibier-carcasse/tree.json';
import grandGibierAbatstree from '@app/data/grand-gibier-abats/tree.json';
import type { AnomalieNavSection } from '@app/components/AnomaliesTreeNavigator';
import { setCarcasseAnomalie } from '@app/utils/update-carcasse-anomalies';
import { toggleAnomalie } from '@app/utils/anomalies-referentiel';

// Construit les sections du navigateur d'anomalies (carcasse + abats si gros gibier),
// branchées sur le store via setCarcasseAnomalie.
export function buildCarcasseNavSections(carcasse: CarcasseWithModificationRequests): AnomalieNavSection[] {
  const sections: AnomalieNavSection[] = [
    {
      key: 'carcasse',
      label: 'Carcasse',
      tree: carcasse.type === CarcasseType.PETIT_GIBIER ? petitGibierCarcasseTree : grandGibierCarcasseTree,
      selected: carcasse.examinateur_anomalies_carcasse ?? [],
      onToggle: (canonical) =>
        setCarcasseAnomalie({
          carcasse,
          field: 'examinateur_anomalies_carcasse',
          nextValues: toggleAnomalie(carcasse.examinateur_anomalies_carcasse ?? [], canonical),
        }),
      onAddFreeText: (value) =>
        setCarcasseAnomalie({
          carcasse,
          field: 'examinateur_anomalies_carcasse',
          nextValues: [...(carcasse.examinateur_anomalies_carcasse ?? []), value],
        }),
    },
  ];
  if (carcasse.type === CarcasseType.GROS_GIBIER) {
    sections.push({
      key: 'abats',
      label: 'Abats',
      tree: grandGibierAbatstree,
      selected: carcasse.examinateur_anomalies_abats ?? [],
      onToggle: (canonical) =>
        setCarcasseAnomalie({
          carcasse,
          field: 'examinateur_anomalies_abats',
          nextValues: toggleAnomalie(carcasse.examinateur_anomalies_abats ?? [], canonical),
        }),
      onAddFreeText: (value) =>
        setCarcasseAnomalie({
          carcasse,
          field: 'examinateur_anomalies_abats',
          nextValues: [...(carcasse.examinateur_anomalies_abats ?? []), value],
        }),
    });
  }
  return sections;
}
