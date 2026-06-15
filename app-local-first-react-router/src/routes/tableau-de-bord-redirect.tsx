import { Navigate } from 'react-router';
import useUser from '@app/zustand/user';
import { getUserOnboardingRoute } from '@app/utils/user-onboarded.client';

// `/app/tableau-de-bord` a été retiré en #391 mais reste atteint par de vieux
// liens (emails, favoris) et par l'`initial-path` figé de l'app native, d'où
// des 404. On remet la route uniquement comme redirection vers le vrai tableau
// de bord selon le rôle, ou la page d'accueil à défaut (utilisateur déconnecté
// ou sans route d'onboarding).
export default function TableauDeBordRedirect() {
  const user = useUser((state) => state.user);
  let target = '/';
  if (user) {
    try {
      target = getUserOnboardingRoute(user);
    } catch {
      target = '/';
    }
  }
  return (
    <Navigate
      to={target}
      replace
    />
  );
}
