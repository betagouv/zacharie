/// <reference types="node" />

export type SeedRole =
  | 'EXAMINATEUR_INITIAL'
  | 'PREMIER_DETENTEUR'
  | 'PREMIER_DETENTEUR_WITH_PARTAGE'
  | 'ETG'
  | 'ETG_TAKEN_CHARGE'
  | 'ETG_TAKEN_CHARGE_PD_HORS_LIGNE'
  | 'ETG_TAKEN_CHARGE_AND_ASSIGNED_TO_SVI'
  | 'COLLECTEUR_PRO'
  | 'COLLECTEUR_TAKEN_CHARGE'
  | 'SVI'
  | 'SVI_CONSIGNE'
  | 'COMMERCE_DE_DETAIL'
  | 'COMMERCE_DE_DETAIL_DELIVERED'
  | 'SVI_CLOSED'
  | 'ETG_REFUSED'
  | 'ETG_ALL_REFUSED_TO_SVI'
  | 'ETG_PD_EXAMINATEUR'
  | 'ETG_PD_ASSOCIATION'
  | 'CHASSEUR_MULTI_STATUS'
  | 'CHASSEUR_MANY_FICHES'
  | 'FDC'
  | 'FRC'
  | 'FNC'
  | 'FEDERATION_STATS'
  | 'FEDERATION_STATS_CIRCUIT_COURT'
  | 'ETG_FILTRES_RAPIDES'
  | 'ETG_TABLEAU_DE_BORD'
  | 'LABORATOIRE_FTP_RECUE'
  | 'SVI_SANGLIERS'
  | 'API_BAC_A_SABLE';

export async function resetDb(role?: SeedRole) {
  const timer = `resetDb(${role ?? ''})`;
  console.time(timer);
  // le seed tourne dans le process de l'API de test (route montée seulement en NODE_ENV=test)
  const response = await fetch('http://localhost:3291/__e2e/reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  });
  console.timeEnd(timer);
  if (!response.ok) {
    throw new Error(`resetDb(${role ?? ''}) failed: ${response.status} ${await response.text()}`);
  }
}
