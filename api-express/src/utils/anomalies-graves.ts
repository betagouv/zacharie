import type { Carcasse } from '@prisma/client';
// Le référentiel des anomalies vit côté app : on le lit à la source plutôt que d'en garder une copie.
import grosReferentiel from '../../../app-local-first-react-router/src/data/anomalies/gros.json';
import petitReferentiel from '../../../app-local-first-react-router/src/data/anomalies/petit.json';

type AnomalieReferentiel = Array<{
  site: string | null;
  anomalies: Array<{ intitule: string; alert_level: number | null }>;
}>;

// Niveau d'alerte par clé canonique stockée sur la carcasse (« intitulé - site », ou « intitulé » sans site).
const alertLevelByCanonical = new Map<string, number | null>();
for (const section of [
  ...(grosReferentiel as AnomalieReferentiel),
  ...(petitReferentiel as AnomalieReferentiel),
]) {
  for (const item of section.anomalies) {
    const canonical = section.site ? `${item.intitule} - ${section.site}` : item.intitule;
    if (!alertLevelByCanonical.has(canonical)) alertLevelByCanonical.set(canonical, item.alert_level);
  }
}

// Une anomalie est grave à partir du niveau 2 (« ne pas commercialiser »). Par prudence, une anomalie
// sans niveau (tout le référentiel petit gibier) ou hors référentiel est aussi considérée grave.
// Même règle que isAnomalieGrave côté app (app-local-first-react-router/src/utils/anomalies-referentiel.ts).
export function isAnomalieGrave(canonical: string): boolean {
  const alertLevel = alertLevelByCanonical.get(canonical) ?? null;
  return alertLevel === null || alertLevel >= 2;
}

export function hasAnomalieGrave(
  carcasses: Array<Pick<Carcasse, 'examinateur_anomalies_carcasse' | 'examinateur_anomalies_abats'>>
): boolean {
  return carcasses.some((carcasse) =>
    [
      ...(carcasse.examinateur_anomalies_carcasse ?? []),
      ...(carcasse.examinateur_anomalies_abats ?? []),
    ].some(isAnomalieGrave)
  );
}
