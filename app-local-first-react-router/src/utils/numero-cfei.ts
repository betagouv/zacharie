const NUMERO_CFEI_REGEX = /^(CFEI-(\d{2,3}|2[AB])|(\d{2,3}|2[AB])-FREI)-\d{2}-\d+$/i;

export const NUMERO_CFEI_FORMAT_MESSAGE =
  'Ce numéro ne correspond pas au format attendu (ex. CFEI-075-25-001).';

export const NUMERO_CFEI_FORMAT_MESSAGE_CHASSEUR = `${NUMERO_CFEI_FORMAT_MESSAGE} Vérifiez-le sur votre attestation.`;

export function isNumeroCfeiValide(numeroCfei: string) {
  return NUMERO_CFEI_REGEX.test(numeroCfei.trim());
}

export function isNumeroCfeiHorsFormat(numeroCfei: string) {
  return !!numeroCfei.trim() && !isNumeroCfeiValide(numeroCfei);
}
