/// <reference types="node" />

export type SeedRole =
  | 'EXAMINATEUR_INITIAL'
  | 'PREMIER_DETENTEUR'
  | 'PREMIER_DETENTEUR_WITH_PARTAGE'
  | 'ETG'
  | 'ETG_TAKEN_CHARGE'
  | 'COLLECTEUR_PRO'
  | 'COLLECTEUR_TAKEN_CHARGE'
  | 'SVI'
  | 'COMMERCE_DE_DETAIL'
  | 'COMMERCE_DE_DETAIL_DELIVERED'
  | 'SVI_CLOSED'
  | 'ETG_REFUSED'
  | 'ETG_ALL_REFUSED_TO_SVI';

// Each Playwright worker hits its own API instance. Worker 0 → 3291, worker 1 → 3293, …
// See playwright.config.ts. The env var is set by Playwright in test processes.
function apiPortForWorker(): number {
  const idx = Number(process.env.TEST_WORKER_INDEX ?? 0);
  return 3291 + idx * 2;
}

export async function resetDb(role?: SeedRole) {
  const port = apiPortForWorker();
  const url = `http://localhost:${port}/__test/reset${role ? `?role=${role}` : ''}`;
  const res = await fetch(url, { method: 'POST' });
  if (!res.ok) {
    throw new Error(`resetDb failed (${res.status}): ${await res.text()}`);
  }
}
