import jwt from 'jsonwebtoken';
import { SECRET } from '~/config';
import { JWT_MAX_AGE } from '~/utils/cookie';

// Durée de validité d'une authentification ProConnect pour un admin : alignée sur la session ProConnect (12h).
export const PROCONNECT_MAX_AGE = 60 * 60 * 12; // seconds

export interface SessionTokenPayload {
  userId: string;
  // epoch en secondes de la dernière authentification ProConnect réussie (admins uniquement)
  proconnect_at?: number;
}

export function signSessionToken(payload: SessionTokenPayload) {
  return jwt.sign(payload, SECRET, { expiresIn: JWT_MAX_AGE });
}

export function hasValidProConnect(payload: SessionTokenPayload) {
  if (!payload.proconnect_at) return false;
  const nowInSeconds = Math.floor(Date.now() / 1000);
  return nowInSeconds - payload.proconnect_at < PROCONNECT_MAX_AGE;
}

// Un jeton émis avant le dernier changement de mot de passe est refusé : changer son mot de passe coupe les autres sessions.
// `iat` est en secondes : un jeton émis dans la même seconde que le changement (celui de la session courante) reste valide.
export function isTokenRevokedByPasswordChange(
  payload: { iat?: number },
  passwordChangedAt: Date | null | undefined
) {
  if (!passwordChangedAt) return false;
  if (!payload.iat) return true;
  return payload.iat < Math.floor(passwordChangedAt.getTime() / 1000);
}
