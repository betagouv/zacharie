// champs d'une clé API qu'on peut renvoyer à un utilisateur : jamais private_key, public_key ni access_token
export const apiKeySafeSelect = {
  id: true,
  dedicated_to_entity_id: true,
  name: true,
  description: true,
  active: true,
  webhook_url: true,
  expires_at: true,
  last_used_at: true,
  scopes: true,
  rate_limit: true,
  created_at: true,
  updated_at: true,
  deleted_at: true,
} as const;
