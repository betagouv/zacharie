export const DELTA_MARGIN_MS = 5 * 60 * 1000;

export function getDeltaAfter(lastUpdateFromServer: number) {
  if (!lastUpdateFromServer) return 0;
  return Math.max(1, lastUpdateFromServer - DELTA_MARGIN_MS);
}

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
