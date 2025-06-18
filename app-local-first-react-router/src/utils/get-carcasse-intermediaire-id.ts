export function getCarcasseIntermediaireId(
  feiNumero: string,
  carcasseBracelet: string,
  feiIntermediaireId: string,
): string {
  return `${feiNumero}__${carcasseBracelet}__${feiIntermediaireId}`;
}

export function getNewCarcasseIntermediaireId(
  date: string,
  userId: string,
  feiNumero: string,
  carcasseBracelet: string,
): string {
  return `${feiNumero}__${carcasseBracelet}__${userId}__${date}`;
}
