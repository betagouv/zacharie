import { useEffect, useState } from 'react';
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router';
import {
  createFicheUrl,
  fetchFiches,
  listWebhookEvents,
  requestApproval,
  saveApiKey,
  type FichePrefill,
  type WebhookEvent,
} from '../functions';
import type { ZacharieCall } from '../server/zacharie';
import { ESPECES } from '../especes';

export const Route = createFileRoute('/')({
  beforeLoad: ({ context }) => {
    if (!context.user) throw redirect({ to: '/connexion' });
    return { user: context.user };
  },
  component: Dashboard,
});

function Dashboard() {
  const { user } = Route.useRouteContext();
  return (
    <>
      <h1>Tester l'API Zacharie</h1>
      <p>Ce bac à sable joue le rôle d'une application tierce.</p>
      <Etape0 hint={user.zacharie_api_key_hint} />
      <Etape1
        defaultEmail={user.zacharie_email ?? ''}
        disabled={!user.zacharie_api_key_hint}
      />
      <Etape2 disabled={!user.zacharie_api_key_hint || !user.zacharie_email} />
      <Etape3 disabled={!user.zacharie_api_key_hint || !user.zacharie_email} />
    </>
  );
}

function Etape0({ hint }: { hint: string | null }) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(!hint);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  useEffect(() => setWebhookUrl(`${window.location.origin}/api/webhook`), []);

  return (
    <section className="fr-mb-8w">
      <h2>0. Clé API Zacharie</h2>
      <p>
        Demandez à un administrateur Zacharie de créer une clé API tierce partie avec les scopes
        <br />
        <code>FEI_READ_FOR_USER</code>,
        <br />
        <code>CARCASSE_READ_FOR_USER</code>,
        <br />
        et <code>USER_LOGIN_FOR_USER</code>.<br />
        Puis collez ici sa clé privée.
      </p>
      <p>
        Pour recevoir les webhooks, l'administrateur renseigne aussi l'URL de webhook de la clé :{' '}
        <code>{webhookUrl}</code>
      </p>
      {hint && !isEditing && (
        <p>
          Clé enregistrée : <code>…{hint}</code>{' '}
          <button
            type="button"
            className="fr-link fr-ml-2w"
            onClick={() => setIsEditing(true)}
          >
            Remplacer
          </button>
        </p>
      )}
      {isEditing && (
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            const apiKey = String(new FormData(event.currentTarget).get('apiKey'));
            setPending(true);
            setError(null);
            try {
              await saveApiKey({ data: { apiKey } });
              await router.invalidate();
              setIsEditing(false);
            } catch (e) {
              setError((e as Error).message);
            }
            setPending(false);
          }}
        >
          <div className="fr-input-group">
            <label
              className="fr-label"
              htmlFor="apiKey"
            >
              Clé privée
            </label>
            <input
              className="fr-input"
              id="apiKey"
              name="apiKey"
              type="password"
              autoComplete="off"
              required
            />
          </div>
          <ul className="fr-btns-group fr-btns-group--inline">
            <li>
              <button
                className="fr-btn"
                type="submit"
                disabled={pending}
              >
                Enregistrer la clé
              </button>
            </li>
            {hint && (
              <li>
                <button
                  className="fr-btn fr-btn--tertiary"
                  type="button"
                  onClick={() => setIsEditing(false)}
                >
                  Annuler
                </button>
              </li>
            )}
          </ul>
        </form>
      )}
      <ErrorAlert error={error} />
    </section>
  );
}

function Etape1({ defaultEmail, disabled }: { defaultEmail: string; disabled: boolean }) {
  const router = useRouter();
  const [call, setCall] = useState<ZacharieCall | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const status: string | undefined = call?.json?.data?.approvalStatus;

  return (
    <section className="fr-mb-8w">
      <h2>1. Lier un compte Zacharie</h2>
      <p>
        Le bac à sable demande l'accès aux données d'un utilisateur Zacharie.
        <br />
        L'utilisateur accepte ensuite dans Zacharie : <em>Paramètres › Partage de mes données</em>.
      </p>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          const zacharieEmail = String(new FormData(event.currentTarget).get('zacharieEmail'));
          setPending(true);
          setError(null);
          try {
            setCall(await requestApproval({ data: { zacharieEmail } }));
            await router.invalidate();
          } catch (e) {
            setError((e as Error).message);
          }
          setPending(false);
        }}
      >
        <fieldset
          className="fr-fieldset"
          disabled={disabled}
        >
          <div className="fr-fieldset__element">
            <div className="fr-input-group">
              <label
                className="fr-label"
                htmlFor="zacharieEmail"
              >
                Email du compte Zacharie
                <span className="fr-hint-text">En dev : examinateur-premier-detenteur@example.fr</span>
              </label>
              <input
                className="fr-input"
                id="zacharieEmail"
                name="zacharieEmail"
                type="email"
                defaultValue={defaultEmail}
                required
              />
            </div>
          </div>
        </fieldset>
        <button
          className="fr-btn"
          type="submit"
          disabled={disabled || pending}
        >
          {defaultEmail ? "Vérifier le statut de l'accès" : "Demander l'accès"}
        </button>
      </form>
      {status && (
        <p className="fr-mt-3w">
          Statut de l'accès :{' '}
          <span
            className={`fr-badge ${status === 'APPROVED' ? 'fr-badge--success' : status === 'REJECTED' ? 'fr-badge--error' : 'fr-badge--info'}`}
          >
            {status}
          </span>{' '}
          {call?.json?.data?.habilitePourExamenInitial ? (
            <span className="fr-badge fr-badge--success">Habilité à l'examen initial</span>
          ) : (
            <span className="fr-badge fr-badge--warning">Pas habilité à l'examen initial</span>
          )}
        </p>
      )}
      <ErrorAlert error={error} />
      <CallDetails call={call} />
    </section>
  );
}

const today = () => new Date().toISOString().slice(0, 10);
const emptyCarcasse = () => ({ numero_bracelet: '', espece: 'Chevreuil', nombre_d_animaux: '1' });

function Etape2({ disabled }: { disabled: boolean }) {
  const [prefill, setPrefill] = useState<FichePrefill>({
    date_mise_a_mort: today(),
    commune_mise_a_mort: '',
    heure_mise_a_mort_premiere_carcasse: '',
    heure_evisceration_derniere_carcasse: '',
    carcasses: [emptyCarcasse()],
  });
  const [result, setResult] = useState<{
    call: ZacharieCall;
    url: string | null;
    requestedAt: string;
  } | null>(null);
  const [openedIn, setOpenedIn] = useState<'page' | 'onglet'>('page');
  const [listenToWebhooks, setListenToWebhooks] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const setField = (key: Exclude<keyof FichePrefill, 'carcasses'>, value: string) =>
    setPrefill((p) => ({ ...p, [key]: value }));
  const setCarcasse = (index: number, key: keyof FichePrefill['carcasses'][number], value: string) =>
    setPrefill((p) => ({
      ...p,
      carcasses: p.carcasses.map((c, i) => (i === index ? { ...c, [key]: value } : c)),
    }));

  return (
    <section className="fr-mb-8w">
      <h2>2. Créer une fiche pré-remplie</h2>
      <p>
        Le bac à sable demande un access token (valable 5 minutes), puis ouvre Zacharie avec les champs
        pré-remplis : soit intégré dans cette page (comme dans une application mobile), soit dans un nouvel
        onglet. Tous les champs sont facultatifs.
      </p>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
          const target = submitter?.value === 'onglet' ? 'onglet' : 'page';
          // l'onglet est ouvert pendant le clic, sinon le navigateur bloque la fenêtre surgissante
          const newTab = target === 'onglet' ? window.open('', '_blank') : null;
          setOpenedIn(target);
          setPending(true);
          setError(null);
          setResult(null);
          try {
            const response = await createFicheUrl({ data: { ...prefill, embedded: target === 'page' } });
            setResult(response);
            if (newTab) {
              if (response.url) newTab.location.href = response.url;
              else newTab.close();
            }
          } catch (e) {
            newTab?.close();
            setError((e as Error).message);
          }
          setPending(false);
        }}
      >
        <fieldset
          className="fr-fieldset"
          disabled={disabled}
        >
          <div className="fr-fieldset__element fr-col-12 fr-col-md-6">
            <TextInput
              label="Date de mise à mort"
              type="date"
              value={prefill.date_mise_a_mort}
              onChange={(v) => setField('date_mise_a_mort', v)}
            />
          </div>
          <div className="fr-fieldset__element fr-col-12 fr-col-md-6">
            <TextInput
              label="Commune de mise à mort"
              value={prefill.commune_mise_a_mort}
              onChange={(v) => setField('commune_mise_a_mort', v)}
            />
          </div>
          <div className="fr-fieldset__element fr-col-12 fr-col-md-6">
            <TextInput
              label="Heure de mise à mort de la première carcasse"
              type="time"
              value={prefill.heure_mise_a_mort_premiere_carcasse}
              onChange={(v) => setField('heure_mise_a_mort_premiere_carcasse', v)}
            />
          </div>
          <div className="fr-fieldset__element fr-col-12 fr-col-md-6">
            <TextInput
              label="Heure d'éviscération de la dernière carcasse"
              type="time"
              value={prefill.heure_evisceration_derniere_carcasse}
              onChange={(v) => setField('heure_evisceration_derniere_carcasse', v)}
            />
          </div>
        </fieldset>
        <fieldset
          className="fr-fieldset"
          disabled={disabled}
        >
          <legend className="fr-fieldset__legend">Carcasses</legend>
          {prefill.carcasses.map((carcasse, index) => (
            <div
              key={index}
              className="fr-fieldset__element carcasse-row"
            >
              <div className="carcasse-row__field">
                <TextInput
                  id={`numero-bracelet-${index}`}
                  label="Numéro de marquage"
                  value={carcasse.numero_bracelet}
                  onChange={(v) => setCarcasse(index, 'numero_bracelet', v)}
                />
              </div>
              <div className="carcasse-row__field">
                <div className="fr-select-group">
                  <label
                    className="fr-label"
                    htmlFor={`espece-${index}`}
                  >
                    Espèce
                  </label>
                  <select
                    className="fr-select"
                    id={`espece-${index}`}
                    value={carcasse.espece}
                    onChange={(e) => setCarcasse(index, 'espece', e.target.value)}
                  >
                    {ESPECES.map((espece) => (
                      <option key={espece}>{espece}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="carcasse-row__number">
                <TextInput
                  id={`nombre-animaux-${index}`}
                  label="Nombre d'animaux"
                  type="number"
                  value={carcasse.nombre_d_animaux}
                  onChange={(v) => setCarcasse(index, 'nombre_d_animaux', v)}
                />
              </div>
              <div>
                <button
                  type="button"
                  className="fr-btn fr-btn--tertiary"
                  onClick={() =>
                    setPrefill((p) => ({ ...p, carcasses: p.carcasses.filter((_, i) => i !== index) }))
                  }
                >
                  Retirer
                </button>
              </div>
            </div>
          ))}
          <div className="fr-fieldset__element">
            <button
              type="button"
              className="fr-btn fr-btn--secondary"
              onClick={() => setPrefill((p) => ({ ...p, carcasses: [...p.carcasses, emptyCarcasse()] }))}
            >
              Ajouter une carcasse
            </button>
          </div>
        </fieldset>
        <ul className="fr-btns-group fr-btns-group--inline-md">
          <li>
            <button
              className="fr-btn"
              type="submit"
              value="page"
              disabled={disabled || pending}
            >
              Créer sur Zacharie, dans cette page
            </button>
          </li>
          <li>
            <button
              className="fr-btn fr-btn--secondary"
              type="submit"
              value="onglet"
              disabled={disabled || pending}
            >
              Créer sur Zacharie, dans un nouvel onglet
            </button>
          </li>
        </ul>
        <div className="fr-checkbox-group fr-mt-2w">
          <input
            type="checkbox"
            id="listen-to-webhooks"
            checked={listenToWebhooks}
            onChange={(e) => setListenToWebhooks(e.target.checked)}
          />
          <label
            className="fr-label"
            htmlFor="listen-to-webhooks"
          >
            Récupérer automatiquement les carcasses lorsqu'elles sont créées (via le webhook)
            <span className="fr-hint-text">
              Zacharie envoie les carcasses quand l'examinateur initial valide la fiche, puis à chaque étape
              (prise en charge, inspection, clôture).
            </span>
          </label>
        </div>
      </form>

      <ErrorAlert error={error} />
      <CallDetails call={result?.call ?? null} />
      {result?.url && (
        <div className="fr-mt-3w">
          <p>
            URL ouverte (à réutiliser telle quelle dans une WebView, avant expiration du token) :<br />
            <code>{result.url}</code>
          </p>
          {openedIn === 'page' ? (
            <iframe
              className="zacharie-iframe"
              title="Zacharie"
              src={result.url}
            />
          ) : (
            <p>Zacharie s'est ouvert dans un nouvel onglet.</p>
          )}
        </div>
      )}
      {listenToWebhooks && result?.url && <WebhookEvents since={result.requestedAt} />}
    </section>
  );
}

function WebhookEvents({ since }: { since: string }) {
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  // pas de connexion permanente : le bac à sable relit sa base toutes les 3 secondes
  useEffect(() => {
    const refresh = () =>
      listWebhookEvents({ data: { since } })
        .then((list) => {
          setEvents(list);
          setError(null);
        })
        .catch((e: Error) => setError(e.message));
    refresh();
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [since]);

  return (
    <div className="fr-mt-3w">
      <h3 className="fr-h6">Webhooks reçus</h3>
      <ErrorAlert error={error} />
      {!events.length && <p>En attente d'un webhook de Zacharie…</p>}
      {events.map((webhook) => {
        const carcasses: FeiFromApi['carcasses'] = webhook.payload?.carcasses ?? [];
        return (
          <div
            key={webhook.id}
            className="fr-mb-3w"
          >
            <p className="fr-mb-1w">
              <span className="fr-badge fr-badge--sm fr-badge--info">{webhook.event}</span> reçu à{' '}
              {new Date(webhook.receivedAt).toLocaleTimeString('fr-FR')}
              {webhook.payload?.fei?.numero && <> — fiche {webhook.payload.fei.numero}</>}
            </p>
            {carcasses.length > 0 && (
              <ul>
                {carcasses.map((c) => (
                  <li key={c.numero_bracelet}>
                    {c.numero_bracelet} — {c.espece} ({c.nombre_d_animaux}){' '}
                    {c.carcasse_status && <span className="fr-badge fr-badge--sm">{c.carcasse_status}</span>}
                  </li>
                ))}
              </ul>
            )}
            <details>
              <summary>Contenu du webhook</summary>
              <pre className="json-block">{JSON.stringify(webhook.payload, null, 2)}</pre>
            </details>
          </div>
        );
      })}
    </div>
  );
}

const thirtyDaysAgo = () => new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);

type FeiFromApi = {
  numero: string;
  date_mise_a_mort: string | null;
  commune_mise_a_mort: string | null;
  examinateur_initial_name: string | null;
  premier_detenteur_name: string | null;
  creation_context: string | null;
  carcasses: Array<{
    numero_bracelet: string;
    espece: string | null;
    nombre_d_animaux: number | null;
    carcasse_status: string | null;
  }>;
};

function Etape3({ disabled }: { disabled: boolean }) {
  const [range, setRange] = useState({ date_from: thirtyDaysAgo(), date_to: today() });
  const [call, setCall] = useState<ZacharieCall | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const feis: FeiFromApi[] = call?.json?.data?.feis ?? [];

  return (
    <section className="fr-mb-8w">
      <h2>3. Lire les données Zacharie</h2>
      <p>
        Le bac à sable lit les fiches (et leurs carcasses) de l'utilisateur, filtrées par date de mise à mort.
      </p>
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setPending(true);
          setError(null);
          try {
            setCall(await fetchFiches({ data: range }));
          } catch (e) {
            setError((e as Error).message);
          }
          setPending(false);
        }}
      >
        <fieldset
          className="fr-fieldset"
          disabled={disabled}
        >
          <div className="fr-fieldset__element fr-col-12 fr-col-md-6">
            <TextInput
              label="Du"
              type="date"
              value={range.date_from}
              onChange={(v) => setRange((r) => ({ ...r, date_from: v }))}
            />
          </div>
          <div className="fr-fieldset__element fr-col-12 fr-col-md-6">
            <TextInput
              label="Au"
              type="date"
              value={range.date_to}
              onChange={(v) => setRange((r) => ({ ...r, date_to: v }))}
            />
          </div>
        </fieldset>
        <button
          className="fr-btn"
          type="submit"
          disabled={disabled || pending}
        >
          Récupérer les fiches
        </button>
      </form>
      <ErrorAlert error={error} />
      {call && call.status === 200 && (
        <div className="fr-table fr-mt-3w">
          <table>
            <caption>{feis.length} fiche(s)</caption>
            <thead>
              <tr>
                <th>Numéro</th>
                <th>Date de mise à mort</th>
                <th>Commune</th>
                <th>Examinateur</th>
                <th>Premier détenteur</th>
                <th>Contexte de création</th>
                <th>Carcasses</th>
              </tr>
            </thead>
            <tbody>
              {feis.map((fei) => (
                <tr key={fei.numero}>
                  <td>{fei.numero}</td>
                  <td>{fei.date_mise_a_mort}</td>
                  <td>{fei.commune_mise_a_mort}</td>
                  <td>{fei.examinateur_initial_name}</td>
                  <td>{fei.premier_detenteur_name}</td>
                  <td>{fei.creation_context}</td>
                  <td>
                    {fei.carcasses.map((c) => (
                      <div key={c.numero_bracelet}>
                        {c.numero_bracelet} — {c.espece} ({c.nombre_d_animaux}){' '}
                        {c.carcasse_status && (
                          <span className="fr-badge fr-badge--sm">{c.carcasse_status}</span>
                        )}
                      </div>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <CallDetails call={call} />
    </section>
  );
}

function TextInput({
  label,
  value,
  onChange,
  type = 'text',
  id = label.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  id?: string;
}) {
  return (
    <div className="fr-input-group">
      <label
        className="fr-label"
        htmlFor={id}
      >
        {label}
      </label>
      <input
        className="fr-input"
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function ErrorAlert({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <div className="fr-alert fr-alert--error fr-alert--sm fr-mt-3w">
      <p>{error}</p>
    </div>
  );
}

function CallDetails({ call }: { call: ZacharieCall | null }) {
  if (!call) return null;
  const ok = call.status >= 200 && call.status < 300;
  return (
    <details className="fr-mt-3w">
      <summary>
        Appel API : <code>{call.request}</code>{' '}
        <span className={`fr-badge fr-badge--sm ${ok ? 'fr-badge--success' : 'fr-badge--error'}`}>
          {call.status}
        </span>
      </summary>
      {call.requestBody && (
        <>
          <p className="fr-mt-2w fr-mb-1w">Corps de la requête :</p>
          <pre className="json-block">{call.requestBody}</pre>
        </>
      )}
      <p className="fr-mt-2w fr-mb-1w">Réponse :</p>
      <pre className="json-block">{JSON.stringify(call.json, null, 2)}</pre>
    </details>
  );
}
