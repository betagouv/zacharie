// https://developer.matomo.org/api-reference/reporting-api
import { z } from 'zod';
import { MATOMO_TOKEN, MATOMO_URL } from '~/config';

export type MatomoRequestParams = Record<string, string>;

export class MatomoApiError extends Error {
  constructor(message: string) {
    super(`Matomo : ${message}`);
    this.name = 'MatomoApiError';
  }
}

// Matomo répond en 200 même quand la requête échoue
const errorSchema = z.object({ result: z.literal('error'), message: z.string() });

export function throwIfMatomoError(payload: unknown): void {
  const error = errorSchema.safeParse(payload);
  if (error.success) throw new MatomoApiError(error.data.message);
}

// Toujours en POST avec le token dans le body : les tokens « secure only » de Matomo 5 refusent le GET.
// Renvoie un résultat par sous-requête, dans le même ordre.
export async function matomoBulkRequest(requests: Array<MatomoRequestParams>): Promise<Array<unknown>> {
  if (!MATOMO_TOKEN) throw new MatomoApiError('MATOMO_TOKEN non configuré');
  const body = new URLSearchParams({
    module: 'API',
    method: 'API.getBulkRequest',
    format: 'json',
    token_auth: MATOMO_TOKEN,
  });
  requests.forEach((params, index) => {
    body.append(`urls[${index}]`, new URLSearchParams(params).toString());
  });

  const response = await fetch(`${MATOMO_URL.replace(/\/$/, '')}/index.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) throw new MatomoApiError(`HTTP ${response.status}`);

  const payload: unknown = await response.json();
  throwIfMatomoError(payload);
  const results = z.array(z.unknown()).length(requests.length).parse(payload);
  results.forEach(throwIfMatomoError);
  return results;
}
