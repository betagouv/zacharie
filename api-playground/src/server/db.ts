import postgres from 'postgres';
import { DATABASE_URL } from './config';

export const sql = postgres(DATABASE_URL);

export type PlaygroundUser = {
  id: string;
  email: string;
  zacharie_email: string | null;
  // 4 derniers caractères de la clé API : la clé complète ne quitte jamais le serveur
  zacharie_api_key_hint: string | null;
};

let schemaReady: Promise<unknown> | undefined;
export function ensureSchema() {
  schemaReady ??= sql`
    CREATE TABLE IF NOT EXISTS users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email text UNIQUE NOT NULL,
      password_hash text NOT NULL,
      zacharie_email text,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `
    .then(() => sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS zacharie_api_key text`)
    .then(
      () => sql`
        CREATE TABLE IF NOT EXISTS webhook_events (
          id bigserial PRIMARY KEY,
          user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          event text NOT NULL,
          payload jsonb NOT NULL,
          received_at timestamptz NOT NULL DEFAULT now()
        )
      `
    );
  return schemaReady;
}
