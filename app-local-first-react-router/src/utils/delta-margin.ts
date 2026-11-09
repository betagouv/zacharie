// Le pull delta demande les lignes modifiées depuis `lastUpdateFromServer - DELTA_MARGIN_MS`.
// Une ligne écrite dans une transaction lente (script SQL, écriture /sync longue) porte un
// `updated_at` antérieur à son COMMIT : un pull fait entre les deux avance le curseur au-delà de cette
// ligne sans la voir, et sans marge elle ne redescendrait jamais.
export const DELTA_MARGIN_MS = 5 * 60 * 1000;

export function getDeltaAfter(lastUpdateFromServer: number) {
  // 0 = premier chargement, tout le périmètre
  if (!lastUpdateFromServer) return 0;
  return Math.max(1, lastUpdateFromServer - DELTA_MARGIN_MS);
}

// Une ligne renvoyée seulement à cause de la marge (antérieure au curseur) a déjà été reçue : si la
// copie locale porte une modification pas encore envoyée, on la garde. Une ligne que le dernier /sync
// vient d'écrire est postérieure au curseur : elle passe, et remet `is_synced` à true.
export function dropMarginOverwrites<T extends { updated_at: Date | string; is_synced: boolean }>({
  fetched,
  local,
  lastUpdateFromServer,
  idKey,
}: {
  fetched: Array<T>;
  local: Record<string, T | undefined>;
  lastUpdateFromServer: number;
  idKey: (item: T) => string;
}) {
  if (!lastUpdateFromServer) return fetched;
  return fetched.filter((item) => {
    if (new Date(item.updated_at).getTime() >= lastUpdateFromServer) return true;
    const localItem = local[idKey(item)];
    return !localItem || localItem.is_synced;
  });
}
