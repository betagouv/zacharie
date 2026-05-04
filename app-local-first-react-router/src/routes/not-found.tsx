import RootDisplay from '@app/components/RootDisplay';
import NotFound from '@app/components/NotFound';
import { useMostFreshUser } from '@app/utils-offline/get-most-fresh-user';
import { getUserOnboardingRoute } from '@app/utils/user-onboarded.client';

export default function NotFoundRoute() {
  const user = useMostFreshUser('NotFoundRoute');
  const mainLink = user ? getUserOnboardingRoute(user) : '/app/connexion';

  return (
    <RootDisplay
      hideMinistereName
      id="not-found"
      mainLink={mainLink}
    >
      <NotFound />
    </RootDisplay>
  );
}
