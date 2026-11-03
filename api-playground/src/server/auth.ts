import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { deleteCookie, getCookie, setCookie } from '@tanstack/react-start/server';
import { SECURE_COOKIE, SESSION_SECRET } from './config';
import { ensureSchema, sql, type PlaygroundUser } from './db';

const COOKIE_NAME = 'playground_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(':');
  const expected = Buffer.from(hash, 'hex');
  const actual = scryptSync(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function sign(value: string) {
  return createHmac('sha256', SESSION_SECRET).update(value).digest('hex');
}

// cookie signé `userId.expiration.signature` : pas de table de sessions
export function openSession(userId: string) {
  const value = `${userId}.${Date.now() + MAX_AGE_SECONDS * 1000}`;
  setCookie(COOKIE_NAME, `${value}.${sign(value)}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: SECURE_COOKIE,
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
}

export function closeSession() {
  deleteCookie(COOKIE_NAME, { path: '/' });
}

export async function getCurrentUser(): Promise<PlaygroundUser | null> {
  const cookie = getCookie(COOKIE_NAME);
  if (!cookie) return null;
  const [userId, expiresAt, signature] = cookie.split('.');
  if (!userId || !expiresAt || !signature) return null;
  const expected = sign(`${userId}.${expiresAt}`);
  if (signature.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  if (Number(expiresAt) < Date.now()) return null;
  await ensureSchema();
  const [user] = await sql<PlaygroundUser[]>`
    SELECT id, email, zacharie_email, right(zacharie_api_key, 4) AS zacharie_api_key_hint
    FROM users WHERE id = ${userId}
  `;
  return user ?? null;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error('Vous devez être connecté');
  return user;
}
