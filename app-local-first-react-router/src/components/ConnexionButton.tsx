import API from '@app/services/api';
import { refreshUser } from '@app/utils-offline/get-most-fresh-user';
import { getUserOnboardingRoute } from '@app/utils/user-onboarded.client';
import { clearLocalAppState } from '@app/utils/disconnect';
import { Button, ButtonProps } from '@codegouvfr/react-dsfr/Button';
import { User } from '@prisma/client';
import { useState } from 'react';
import { useNavigate } from 'react-router';

export default function ConnexionButton({
  user,
  type = 'primary',
}: {
  user: User;
  type?: ButtonProps['priority'];
}) {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  return (
    <form
      method="POST"
      onSubmit={async (event) => {
        event.preventDefault();
        setIsLoading(true);
        // Session swap (NOT a logout): the POST establishes the
        // impersonated user's session (cookie on web, JWT injected by
        // api.ts on native). We wipe local app state via the shared
        // helper to avoid leaking the admin's cached data into the new
        // session, but deliberately KEEP `useUser` populated so
        // refreshUser() can fetch /user/me with the new session and
        // swap in the impersonated user's profile.
        await API.post({
          path: 'admin/user/connect-as',
          body: { email: user.email! },
        });
        await clearLocalAppState('connect-as');
        const newUser = await refreshUser('admin/user/connect-as');
        if (newUser) {
          navigate(getUserOnboardingRoute(newUser), { replace: true });
        }
      }}
    >
      <Button
        type="submit"
        priority={type}
        disabled={isLoading}
        size="small"
      >
        {isLoading ? 'Connexion en cours...' : 'Connexion'}
      </Button>
    </form>
  );
}
