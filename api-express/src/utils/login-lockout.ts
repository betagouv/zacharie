import { Prisma } from '@prisma/client';

// un compte est bloqué après MAX_FAILED_ATTEMPTS échecs de connexion sur LOCKOUT_DURATION_MINUTES
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MINUTES = 15;

// Sous-requête SQL des emails bloqués, même règle que getLockoutInfo : échecs comptés depuis le dernier
// déblocage admin de la fenêtre. created_at est un timestamp sans fuseau stocké en UTC : la borne est
// calculée en UTC côté base, quel que soit le TimeZone de la session. Elle est écrite en ligne (pas de CTE)
// pour que le planificateur estime le nombre de lignes de la fenêtre et passe par l'index created_at.
export const lockedEmailsSql = Prisma.sql`
  SELECT f.email
  FROM "SecurityLog" f
  WHERE f.action LIKE 'LOGIN_FAILED%'
    AND f.created_at >= (now() AT TIME ZONE 'UTC') - make_interval(mins => ${LOCKOUT_DURATION_MINUTES}::int)
    AND f.created_at >= COALESCE(
      (
        SELECT MAX(d.created_at)
        FROM "SecurityLog" d
        WHERE d.email = f.email
          AND d.action = 'LOGIN_UNLOCK_FROM_ADMIN'
          AND d.created_at >= (now() AT TIME ZONE 'UTC') - make_interval(mins => ${LOCKOUT_DURATION_MINUTES}::int)
      ),
      (now() AT TIME ZONE 'UTC') - make_interval(mins => ${LOCKOUT_DURATION_MINUTES}::int)
    )
  GROUP BY f.email
  HAVING COUNT(*) >= ${MAX_FAILED_ATTEMPTS}
`;
