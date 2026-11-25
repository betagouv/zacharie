export function keepAvailableFilterValues<T>(values: T[], availableValues: T[]): T[] {
  if (values.every((value) => availableValues.includes(value))) return values;
  return values.filter((value) => availableValues.includes(value));
}
