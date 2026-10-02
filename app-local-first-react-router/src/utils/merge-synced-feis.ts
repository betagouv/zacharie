import type { Fei } from '@prisma/client';

// Une fiche sans carcasse ne revient jamais dans le delta de GET /carcasse (qui ne renvoie les
// fiches qu'à travers leurs carcasses) : c'est donc la réponse de /sync qui la confirme. On ne
// remplace la copie locale que si elle n'a pas été modifiée depuis l'envoi, sinon on écraserait
// une modification plus récente qui partira à la prochaine synchro.
export function mergeSyncedFeis(
  localFeis: Record<Fei['numero'], Fei>,
  pushedFeis: Array<Fei>,
  savedFeis: Array<Fei>
): Record<Fei['numero'], Fei> {
  const pushedUpdatedAt = new Map(pushedFeis.map((f) => [f.numero, new Date(f.updated_at).getTime()]));
  const nextFeis = { ...localFeis };
  for (const savedFei of savedFeis) {
    const localFei = localFeis[savedFei.numero];
    if (!localFei) continue;
    if (new Date(localFei.updated_at).getTime() !== pushedUpdatedAt.get(savedFei.numero)) continue;
    nextFeis[savedFei.numero] = { ...savedFei, is_synced: true };
  }
  return nextFeis;
}
