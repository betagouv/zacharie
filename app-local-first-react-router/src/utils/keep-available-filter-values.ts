// Un filtre est enregistré dans le navigateur (localStorage) : il peut garder une valeur qui ne
// correspond plus à aucune option de la liste (fiches d'une autre saison, d'un autre compte connecté
// sur le même navigateur...). Cette valeur n'a pas de case à cocher : on ne filtre pas avec.
export function keepAvailableFilterValues<T>(values: T[], availableValues: T[]): T[] {
  if (values.every((value) => availableValues.includes(value))) return values;
  return values.filter((value) => availableValues.includes(value));
}
