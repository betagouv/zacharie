// Les données venues du serveur (JSON) portent leurs dates en string ISO, alors que les types Prisma
// disent `Date`. On stocke les données créées localement au même format, pour que les comparaisons
// (tri, merge) se comportent pareil quelle que soit l'origine de la donnée.
export function datesToIso<T>(value: T): T {
  if (value instanceof Date) {
    return (Number.isNaN(value.getTime()) ? null : value.toISOString()) as unknown as T;
  }
  if (Array.isArray(value)) return value.map(datesToIso) as unknown as T;
  // on ne parcourt que les objets simples : un événement DOM ou une instance de classe peut être cyclique
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value)) out[key] = datesToIso(v);
    return out as T;
  }
  return value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}
