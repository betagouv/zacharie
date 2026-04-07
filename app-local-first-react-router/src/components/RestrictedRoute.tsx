import { useEffect, type ReactElement } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { UserRoles } from '@prisma/client';
import { useMostFreshUser } from '@app/utils-offline/get-most-fresh-user';
import { hasAllRequiredFields } from '@app/utils/user';
import Chargement from './Chargement';
import DeactivatedAccount from '@app/routes/deactivated';

export default function RestrictedRoute({
  children,
  id,
  zacharieAdmin = false,
}: {
  children: ReactElement;
  id: string;
  zacharieAdmin?: boolean;
}) {
  const user = useMostFreshUser('RestrictedRoute ' + id);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!user?.id) {
      const currentPath = location.pathname + location.search;
      console.log('CONNEXION REQUIRED because no user');
      navigate(`/app/connexion?redirect=${encodeURIComponent(currentPath)}`);
    }
    if (zacharieAdmin && !user?.isZacharieAdmin) {
      const currentPath = location.pathname + location.search;
      console.log('CONNEXION REQUIRED because no zacharieAdmin');
      navigate(`/app/connexion?redirect=${encodeURIComponent(currentPath)}`);
    }
  }, [user, navigate, zacharieAdmin, location]);

  if (!user?.id) {
    return <Chargement />;
  }

  const isRestrictedPage =
    !location.pathname.includes('mon-profil') &&
    !location.pathname.includes('onboarding') &&
    !location.pathname.includes('admin');

  if (isRestrictedPage) {
    const needToCompleteExaminateurInitial =
      user?.roles.includes(UserRoles.CHASSEUR) && user?.est_forme_a_l_examen_initial == null;
    const isProfileCompleted = hasAllRequiredFields(user!) && !needToCompleteExaminateurInitial;

    if (!isProfileCompleted) {
      return <DeactivatedAccount />;
    }
  }

  return children;
}
