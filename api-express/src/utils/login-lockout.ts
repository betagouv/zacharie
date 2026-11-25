import dayjs from 'dayjs';
import prisma from '~/prisma';

// un compte est bloqué pendant LOCKOUT_DURATION_MINUTES dès qu'il atteint MAX_FAILED_ATTEMPTS échecs
// de connexion sur LOCKOUT_DURATION_MINUTES
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MINUTES = 15;

// LOGIN_FAILED_ALREADY_LOCKED est écrit à chaque tentative pendant le blocage : on ne le compte pas,
// sinon quelques requêtes par quart d'heure suffisent à garder n'importe quel compte bloqué
export const LOCKOUT_FAILED_ACTIONS = {
  startsWith: 'LOGIN_FAILED',
  not: 'LOGIN_FAILED_ALREADY_LOCKED',
} as const;

// écrit au MAX_FAILED_ATTEMPTS-ième échec : le blocage dure LOCKOUT_DURATION_MINUTES à partir de cette ligne
export const LOGIN_LOCKED_ACTION = 'LOGIN_LOCKED';

export type LockoutState = {
  locked_at: Date | null;
  // échecs comptés sur la fenêtre, depuis le dernier déblocage admin
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
  // un blocage terminé a plus de LOCKOUT_DURATION_MINUTES : les échecs qui l'ont déclenché sont hors fenêtre
  const failuresTowardLock = await prisma.securityLog.count({
    where: { email, action: LOCKOUT_FAILED_ACTIONS, created_at: { gte: lastUnlock?.created_at ?? since } },
  });
  return { locked_at: null, failures_toward_lock: failuresTowardLock };
}

export function getLockoutExpiresAt(lockedAt: Date) {
  return dayjs(lockedAt).add(LOCKOUT_DURATION_MINUTES, 'minute').toDate();
}
