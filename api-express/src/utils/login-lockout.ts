import dayjs from 'dayjs';
import prisma from '~/prisma';

export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MINUTES = 15;

export const LOCKOUT_FAILED_ACTIONS = {
  startsWith: 'LOGIN_FAILED',
  not: 'LOGIN_FAILED_ALREADY_LOCKED',
} as const;

export const LOGIN_LOCKED_ACTION = 'LOGIN_LOCKED';

export type LockoutState = {
  locked_at: Date | null;
  failures_toward_lock: number;
};

export async function getLockoutState(email: string): Promise<LockoutState> {
  const since = dayjs().subtract(LOCKOUT_DURATION_MINUTES, 'minute').toDate();
  const [lastUnlock, lastLock] = await Promise.all([
    prisma.securityLog.findFirst({
      where: { email, action: 'LOGIN_UNLOCK_FROM_ADMIN', created_at: { gte: since } },
      orderBy: { created_at: 'desc' },
    }),
    prisma.securityLog.findFirst({
      where: { email, action: LOGIN_LOCKED_ACTION, created_at: { gte: since } },
      orderBy: { created_at: 'desc' },
    }),
  ]);
  const lockedAt =
    lastLock && (!lastUnlock || lastLock.created_at > lastUnlock.created_at) ? lastLock.created_at : null;
  if (lockedAt) return { locked_at: lockedAt, failures_toward_lock: 0 };
  const failuresTowardLock = await prisma.securityLog.count({
    where: { email, action: LOCKOUT_FAILED_ACTIONS, created_at: { gte: lastUnlock?.created_at ?? since } },
  });
  return { locked_at: null, failures_toward_lock: failuresTowardLock };
}

export function getLockoutExpiresAt(lockedAt: Date) {
  return dayjs(lockedAt).add(LOCKOUT_DURATION_MINUTES, 'minute').toDate();
}
