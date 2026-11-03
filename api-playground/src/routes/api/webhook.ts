import { createFileRoute } from '@tanstack/react-router';
import { ensureSchema, sql } from '../../server/db';

// Zacharie envoie ses webhooks ici, signés avec la clé privée : `Authorization: Bearer <clé>`.
// L'événement est rangé pour chaque compte du bac à sable qui a enregistré cette clé.
export const Route = createFileRoute('/api/webhook')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authorization = request.headers.get('authorization') ?? '';
        const apiKey = authorization.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : '';
        if (!apiKey) return Response.json({ ok: false, error: 'Clé API manquante' }, { status: 401 });
        await ensureSchema();
        const users = await sql<{ id: string }[]>`SELECT id FROM users WHERE zacharie_api_key = ${apiKey}`;
        if (!users.length) return Response.json({ ok: false, error: 'Clé API inconnue' }, { status: 401 });
        const payload = await request.json();
        for (const user of users) {
          await sql`
            INSERT INTO webhook_events (user_id, event, payload)
            VALUES (${user.id}, ${String(payload?.event ?? 'INCONNU')}, ${sql.json(payload)})
          `;
        }
        return Response.json({ ok: true });
      },
    },
  },
});
