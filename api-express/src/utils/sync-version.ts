import type { User } from '@prisma/client';

export function isStaleWrite(
  existing: { version: number; version_user_id: string | null },
  sentVersion: unknown,
  user: User
): boolean {
  const version = typeof sentVersion === 'number' ? sentVersion : 0;
  if (version < existing.version) return existing.version_user_id !== user.id;
  return false;
}

export function nextVersion(userId: string | null) {
  return { version: { increment: 1 }, version_user_id: userId };
}
