import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import { CredentialsForm } from '../credentials-form';
import { signup } from '../functions';

export const Route = createFileRoute('/inscription')({
  beforeLoad: ({ context }) => {
    if (context.user) throw redirect({ to: '/' });
  },
  component: () => (
    <CredentialsForm
      title="Créer un compte bac à sable"
      submitLabel="Créer mon compte"
      autoComplete="new-password"
      action={signup}
      footer={
        <p>
          Ce compte n'existe que dans le bac à sable : ce n'est pas un compte Zacharie.{' '}
          <Link to="/connexion">J'ai déjà un compte</Link>
        </p>
      }
    />
  ),
});
