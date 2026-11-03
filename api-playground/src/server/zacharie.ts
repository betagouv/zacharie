import { ZACHARIE_API_URL } from './config';
import { sql } from './db';

// trace complète de l'appel, affichée telle quelle dans le bac à sable
export type ZacharieCall = {
  request: string;
  requestBody: string | null;
  status: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  json: any;
};

export async function callZacharie(
  userId: string,
  method: 'GET' | 'POST',
  path: string,
  { query, body }: { query?: Record<string, string>; body?: Record<string, unknown> } = {}
): Promise<ZacharieCall> {
  const [{ zacharie_api_key: apiKey }] = await sql<{ zacharie_api_key: string | null }[]>`
    SELECT zacharie_api_key FROM users WHERE id = ${userId}
  `;
  if (!apiKey) throw new Error("Renseignez d'abord la clé API Zacharie (étape 0)");
  const url = new URL(`${ZACHARIE_API_URL}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) url.searchParams.set(key, value);
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let json: unknown = text;
  try {
    json = JSON.parse(text);
  } catch {
    // réponse non JSON : on garde le texte brut
  }
  return {
    request: `${method} ${url.toString()}`,
    requestBody: body ? JSON.stringify(body, null, 2) : null,
    status: response.status,
    json,
  };
}
