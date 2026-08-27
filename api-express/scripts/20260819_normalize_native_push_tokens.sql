-- Normalisation de User.native_push_tokens.
--
-- Avant : la WebView Expo injecte l'objet token entier sérialisé
--         (`{"type":"expo","data":"ExponentPushToken[…]"}`) et la webapp le stockait tel quel.
-- Après : on ne stocke que la valeur du token (`ExponentPushToken[…]`), seul format accepté
--         par l'API push d'Expo.
--
-- La webapp fait désormais l'extraction avant d'envoyer (useNativePushToken.ts), ce script
-- rattrape les lignes déjà en base.
--
-- À exécuter UNE FOIS, manuellement, sur la base (preprod puis prod), juste avant le merge.

BEGIN;

UPDATE "User" u
SET native_push_tokens = sub.tokens
FROM (
  SELECT
    id,
    ARRAY(
      SELECT DISTINCT token
      FROM (
        -- On extrait `data` par expression régulière plutôt que par un cast ::jsonb : une entrée
        -- tronquée ou non-JSON ferait échouer le cast, et donc tout le script.
        SELECT
          CASE
            WHEN t LIKE '{%' THEN substring(t from '"data"[[:space:]]*:[[:space:]]*"([^"]*)"')
            ELSE t
          END AS token
        FROM unnest(native_push_tokens) AS t
        WHERE t <> '' AND t <> 'null'
      ) AS normalized
      WHERE token IS NOT NULL AND token <> ''
    ) AS tokens
  FROM "User"
  WHERE EXISTS (
    SELECT 1 FROM unnest(native_push_tokens) AS t WHERE t LIKE '{%' OR t = '' OR t = 'null'
  )
) AS sub
WHERE u.id = sub.id;

COMMIT;
