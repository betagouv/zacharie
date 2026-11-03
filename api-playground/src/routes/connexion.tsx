import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import { CredentialsForm } from '../credentials-form';
import { login } from '../functions';

export const Route = createFileRoute('/connexion')({
  beforeLoad: ({ context }) => {
    if (context.user) throw redirect({ to: '/' });
  },
  component: () => (
    <CredentialsForm
      title="Connexion au bac à sable"
      submitLabel="Se connecter"
      autoComplete="current-password"
      action={login}
      footer={
        <p>
          Pas encore de compte ? <Link to="/inscription">Créer un compte bac à sable</Link>
        </p>
      }
    />
  ),
});
