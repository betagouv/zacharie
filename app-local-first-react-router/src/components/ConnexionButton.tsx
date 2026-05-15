import API from '@app/services/api';
import { clearCache } from '@app/services/indexed-db';
import { refreshUser } from '@app/utils-offline/get-most-fresh-user';
import { getUserOnboardingRoute } from '@app/utils/user-onboarded.client';
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
        await API.post({
          path: 'admin/user/connect-as',
          body: { email: user.email! },
        });
        await clearCache()
          .then(() => new Promise((resolve) => setTimeout(resolve, 1500)))
          .then(() => refreshUser('admin/user/connect-as'))
          .then((user) => {
            if (user) {
              navigate(getUserOnboardingRoute(user), { replace: true });
            }
          });
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
