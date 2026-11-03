import { useState, type ReactNode } from 'react';
import { useRouter } from '@tanstack/react-router';

type Props = {
  title: string;
  submitLabel: string;
  autoComplete: 'current-password' | 'new-password';
  action: (args: { data: { email: string; password: string } }) => Promise<{ error: string | null }>;
  footer: ReactNode;
};

export function CredentialsForm({ title, submitLabel, autoComplete, action, footer }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <div className="fr-grid-row fr-grid-row--center">
      <div className="fr-col-12 fr-col-md-6">
        <h1>{title}</h1>
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            setPending(true);
            const result = await action({
              data: { email: String(form.get('email')), password: String(form.get('password')) },
            });
            setPending(false);
            if (result.error) return setError(result.error);
            await router.invalidate();
            await router.navigate({ to: '/' });
          }}
        >
          <div className="fr-input-group">
            <label
              className="fr-label"
              htmlFor="email"
            >
              Email
            </label>
            <input
              className="fr-input"
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </div>
          <div className="fr-input-group">
            <label
              className="fr-label"
              htmlFor="password"
            >
              Mot de passe
              <span className="fr-hint-text">8 caractères minimum</span>
            </label>
            <input
              className="fr-input"
              id="password"
              name="password"
              type="password"
              autoComplete={autoComplete}
              minLength={8}
              required
            />
          </div>
          {error && (
            <div className="fr-alert fr-alert--error fr-alert--sm fr-mb-3w">
              <p>{error}</p>
            </div>
          )}
          <button
            className="fr-btn"
            type="submit"
            disabled={pending}
          >
            {submitLabel}
          </button>
        </form>
        <div className="fr-mt-4w">{footer}</div>
      </div>
    </div>
  );
}
