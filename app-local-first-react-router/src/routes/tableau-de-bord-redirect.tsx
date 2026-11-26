import { Navigate } from 'react-router';
import useUser from '@app/zustand/user';
import { getUserOnboardingRoute } from '@app/utils/user-onboarded.client';

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
