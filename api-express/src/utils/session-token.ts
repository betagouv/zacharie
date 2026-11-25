import jwt from 'jsonwebtoken';
import { SECRET } from '~/config';
import { JWT_MAX_AGE } from '~/utils/cookie';

export const PROCONNECT_MAX_AGE = 60 * 60 * 12;

export interface SessionTokenPayload {
  userId: string;
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

export function isTokenRevokedByPasswordChange(
  payload: { iat?: number },
  passwordChangedAt: Date | null | undefined
) {
  if (!passwordChangedAt) return false;
  if (!payload.iat) return true;
  return payload.iat < Math.floor(passwordChangedAt.getTime() / 1000);
}
