import { createServerFn } from '@tanstack/react-start';
import {
  closeSession,
  getCurrentUser,
  hashPassword,
  openSession,
  requireUser,
  verifyPassword,
} from './server/auth';
import { ensureSchema, sql } from './server/db';
import { ZACHARIE_APP_URL } from './server/config';
import { callZacharie, type ZacharieCall } from './server/zacharie';

type Credentials = { email: string; password: string };

export const getMe = createServerFn({ method: 'GET' }).handler(async () => getCurrentUser());

export const signup = createServerFn({ method: 'POST' })
  .validator((data: Credentials) => data)
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();
    if (!email.includes('@')) return { error: 'Adresse email invalide' };
    if (data.password.length < 8) return { error: 'Le mot de passe doit contenir au moins 8 caractères' };
    await ensureSchema();
    const [existing] = await sql`SELECT id FROM users WHERE email = ${email}`;
    if (existing) return { error: 'Un compte existe déjà avec cette adresse email' };
    const [user] = await sql<{ id: string }[]>`
      INSERT INTO users (email, password_hash) VALUES (${email}, ${hashPassword(data.password)}) RETURNING id
    `;
    openSession(user.id);
    return { error: null };
  });

export const login = createServerFn({ method: 'POST' })
  .validator((data: Credentials) => data)
  .handler(async ({ data }) => {
    await ensureSchema();
    const [user] = await sql<{ id: string; password_hash: string }[]>`
      SELECT id, password_hash FROM users WHERE email = ${data.email.trim().toLowerCase()}
    `;
    if (!user || !verifyPassword(data.password, user.password_hash)) {
      return { error: 'Email ou mot de passe incorrect' };
    }
    openSession(user.id);
    return { error: null };
  });

export const logout = createServerFn({ method: 'POST' }).handler(async () => {
  closeSession();
});

// étape 0 : clé privée de la clé API tierce partie, créée dans Zacharie (/app/admin)
export const saveApiKey = createServerFn({ method: 'POST' })
  .validator((data: { apiKey: string }) => data)
  .handler(async ({ data }) => {
    const user = await requireUser();
    await sql`UPDATE users SET zacharie_api_key = ${data.apiKey.trim() || null} WHERE id = ${user.id}`;
  });

// étape 1 : demande d'accès aux données d'un utilisateur Zacharie
export const requestApproval = createServerFn({ method: 'POST' })
  .validator((data: { zacharieEmail: string }) => data)
  .handler(async ({ data }): Promise<ZacharieCall> => {
    const user = await requireUser();
    const zacharieEmail = data.zacharieEmail.trim().toLowerCase();
    await sql`UPDATE users SET zacharie_email = ${zacharieEmail} WHERE id = ${user.id}`;
    return callZacharie(user.id, 'POST', '/v1/approval-request/user', { body: { email: zacharieEmail } });
  });

export type FichePrefill = {
  date_mise_a_mort: string;
  commune_mise_a_mort: string;
  heure_mise_a_mort_premiere_carcasse: string;
  heure_evisceration_derniere_carcasse: string;
  carcasses: Array<{ numero_bracelet: string; espece: string; nombre_d_animaux: string }>;
};

// étape 2 : access token (valable 5 min) puis URL de création de fiche pré-remplie
export const createFicheUrl = createServerFn({ method: 'POST' })
  .validator((data: FichePrefill & { embedded: boolean }) => data)
  .handler(async ({ data }): Promise<{ call: ZacharieCall; url: string | null; requestedAt: string }> => {
    const requestedAt = new Date().toISOString();
    const user = await requireUser();
    if (!user.zacharie_email) throw new Error("Renseignez d'abord l'email du compte Zacharie (étape 1)");
    const call = await callZacharie(user.id, 'POST', '/v1/access-token/user', {
      body: { email: user.zacharie_email },
    });
    const accessToken: string | undefined = call.json?.data?.accessToken;
    if (!accessToken) return { call, url: null, requestedAt };

    const params = new URLSearchParams({ access_token: accessToken });
    const { carcasses, embedded, ...fields } = data;
    for (const [key, value] of Object.entries(fields)) {
      if (value.trim()) params.set(key, value.trim());
    }
    for (const carcasse of carcasses) {
      if (!carcasse.numero_bracelet.trim()) continue;
      params.append(
        'carcasse',
        [carcasse.numero_bracelet.trim(), carcasse.espece, carcasse.nombre_d_animaux.trim() || '1'].join(',')
      );
    }
    // affichage intégré (iframe / WebView) : Zacharie masque sa navigation
    if (embedded) params.set('embedded', 'true');
    return { call, url: `${ZACHARIE_APP_URL}/app/nouvelle-fiche?${params.toString()}`, requestedAt };
  });

// étape 3 : lecture des fiches (et de leurs carcasses) de l'utilisateur Zacharie
export const fetchFiches = createServerFn({ method: 'POST' })
  .validator((data: { date_from: string; date_to: string }) => data)
  .handler(async ({ data }): Promise<ZacharieCall> => {
    const user = await requireUser();
    if (!user.zacharie_email) throw new Error("Renseignez d'abord l'email du compte Zacharie (étape 1)");
    return callZacharie(user.id, 'GET', '/v1/fei/user', {
      query: { date_from: data.date_from, date_to: data.date_to, email: user.zacharie_email },
    });
  });

export type WebhookEvent = {
  id: string;
  event: string;
  receivedAt: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any;
};

// webhooks reçus sur /api/webhook depuis `since` (cf src/routes/api/webhook.ts)
export const listWebhookEvents = createServerFn({ method: 'POST' })
  .validator((data: { since: string }) => data)
  .handler(async ({ data }): Promise<WebhookEvent[]> => {
    const user = await requireUser();
    const rows = await sql<{ id: string; event: string; received_at: Date; payload: unknown }[]>`
      SELECT id::text, event, received_at, payload FROM webhook_events
      WHERE user_id = ${user.id} AND received_at >= ${data.since}
      ORDER BY received_at DESC
      LIMIT 50
    `;
    return rows.map((row) => ({
      id: row.id,
      event: row.event,
      receivedAt: row.received_at.toISOString(),
      payload: row.payload,
    }));
  });
