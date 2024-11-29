export function getCarcasseIntermediaireId(
  feiNumero: string,
  carcasseBracelet: string,
  feiIntermediaireId: string,
): string {
  return `${feiNumero}__${carcasseBracelet}__${feiIntermediaireId}`;
}
