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
-- À exécuter UNE FOIS, manuellement, sur la base (preprod puis prod).

BEGIN;

UPDATE "User" u
SET native_push_tokens = sub.tokens
FROM (
  SELECT
    id,
    ARRAY(
      -- entrées au format JSON : on extrait `data`
      SELECT t::jsonb ->> 'data'
      FROM unnest(native_push_tokens) AS t
      WHERE t LIKE '{%' AND (t::jsonb ->> 'data') IS NOT NULL
      UNION
      -- entrées déjà normalisées : on les garde telles quelles
      SELECT t
      FROM unnest(native_push_tokens) AS t
      WHERE t NOT LIKE '{%' AND t <> '' AND t <> 'null'
    ) AS tokens
  FROM "User"
  WHERE EXISTS (
    SELECT 1 FROM unnest(native_push_tokens) AS t WHERE t LIKE '{%' OR t = '' OR t = 'null'
  )
) AS sub
WHERE u.id = sub.id;

COMMIT;
