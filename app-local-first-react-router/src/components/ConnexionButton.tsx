import API from '@app/services/api';
import { refreshUser } from '@app/utils-offline/get-most-fresh-user';
import { getUserOnboardingRoute } from '@app/utils/user-onboarded.client';
import { clearLocalAppState } from '@app/utils/disconnect';
import { Button, ButtonProps } from '@codegouvfr/react-dsfr/Button';
import { User } from '@prisma/client';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import useZustandStore from '@app/zustand/store';

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
    <Button
      type="button"
      priority={type}
      disabled={isLoading}
      size="small"
      onClick={async () => {
        setIsLoading(true);
        await API.post({
          path: 'admin/user/connect-as',
          body: { email: user.email! },
        });
        await clearLocalAppState('connect-as');
        useZustandStore.getState().reset();
        const newUser = await refreshUser('admin/user/connect-as');
        if (newUser) {
          navigate(getUserOnboardingRoute(newUser), { replace: true });
        }
      }}
    >
      {isLoading ? 'Connexion en cours...' : 'Connexion'}
    </Button>
  );
}
