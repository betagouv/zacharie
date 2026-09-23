// Les données venues du serveur (JSON) portent leurs dates en string ISO, alors que les types Prisma
// disent `Date`. On stocke les données créées localement au même format, pour que les comparaisons
// (tri, merge) se comportent pareil quelle que soit l'origine de la donnée.
export function datesToIso<T>(value: T): T {
  if (value instanceof Date) return value.toISOString() as unknown as T;
  if (Array.isArray(value)) return value.map(datesToIso) as unknown as T;
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value)) out[key] = datesToIso(v);
    return out as T;
  }
  return value;
}
