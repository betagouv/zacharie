// un compte est bloqué après MAX_FAILED_ATTEMPTS échecs de connexion sur LOCKOUT_DURATION_MINUTES
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MINUTES = 15;

// LOGIN_FAILED_ALREADY_LOCKED est écrit à chaque tentative pendant le blocage : on ne le compte pas,
// sinon quelques requêtes par quart d'heure suffisent à garder n'importe quel compte bloqué
export const LOCKOUT_FAILED_ACTIONS = {
  startsWith: 'LOGIN_FAILED',
  not: 'LOGIN_FAILED_ALREADY_LOCKED',
} as const;
