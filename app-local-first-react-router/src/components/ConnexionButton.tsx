import API from '@app/services/api';
import { refreshUser } from '@app/utils-offline/get-most-fresh-user';
import { getUserOnboardingRoute } from '@app/utils/user-onboarded.client';
import { disconnect } from '@app/utils/disconnect';
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
        // The POST sets the impersonated user's session (cookie on web,
        // native JWT injected by api.ts on the response). We then wipe
        // local state with the shared disconnect helper — skipNavigate
        // because we navigate to the impersonated user's home below,
        // not /app/connexion.
        await API.post({
          path: 'admin/user/connect-as',
          body: { email: user.email! },
        });
        await disconnect({ reason: 'connect-as', skipNavigate: true });
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
