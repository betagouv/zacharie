import dayjs from 'dayjs';

// Helpers de parsing des query params des listes admin (/admin/feis, /admin/carcasses).
// Les listes de valeurs transitent en CSV : `?statuts=ACCEPTE,CONSIGNE`.

export function parseList(value: unknown): string[] {
  if (typeof value !== 'string' || !value) return [];
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

// Ne garde que les valeurs appartenant à l'enum, pour ne pas faire exploser Prisma
// sur une valeur inventée dans l'URL.
export function parseEnumList<T extends string>(value: unknown, allowed: readonly T[]): T[] {
  const allowedSet = new Set<string>(allowed);
  return parseList(value).filter((v): v is T => allowedSet.has(v));
}

// Colonne DateTime : on borne à la journée entière côté serveur.
export function parseDateTimeRange(from: unknown, to: unknown): { gte?: Date; lte?: Date } | undefined {
  const range: { gte?: Date; lte?: Date } = {};
  if (typeof from === 'string' && dayjs(from).isValid()) range.gte = dayjs(from).startOf('day').toDate();
  if (typeof to === 'string' && dayjs(to).isValid()) range.lte = dayjs(to).endOf('day').toDate();
  return Object.keys(range).length ? range : undefined;
}

// Colonne @db.Date (date nue, sans heure) : pas de startOf/endOf, sinon le décalage
// de fuseau fait sortir les bornes.
export function parseDateRange(from: unknown, to: unknown): { gte?: Date; lte?: Date } | undefined {
  const range: { gte?: Date; lte?: Date } = {};
  if (typeof from === 'string' && dayjs(from).isValid()) range.gte = dayjs(from).toDate();
  if (typeof to === 'string' && dayjs(to).isValid()) range.lte = dayjs(to).toDate();
  return Object.keys(range).length ? range : undefined;
}

// Libellé d'affichage d'une entité dans les listes de filtres.
export function entityLabel(entity: {
  id: string;
  nom_d_usage: string | null;
  raison_sociale: string | null;
}): string {
  return entity.nom_d_usage || entity.raison_sociale || entity.id;
}

// Libellé d'affichage d'un utilisateur dans les listes de filtres.
export function userLabel(user: {
  id: string;
  email: string | null;
  prenom: string | null;
  nom_de_famille: string | null;
}): string {
  const nom = [user.prenom, user.nom_de_famille].filter(Boolean).join(' ');
  if (nom && user.email) return `${nom} (${user.email})`;
  return nom || user.email || user.id;
}

export function sortByLabel<T extends { label: string }>(options: T[]): T[] {
  return options.sort((a, b) => a.label.localeCompare(b.label));
}
