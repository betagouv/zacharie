-- Numéros de la liste officielle ("OfficialCfei") réécrits sous leur forme canonique.
--
-- Avant : la liste officielle et les comptes écrivent le même numéro de plusieurs façons
--         (CFEI-45-13-577 / CFEI-45-13-0577 / CFEI-045-13-00577, tirets typographiques, espaces,
--         minuscules, sans préfixe « CFEI- » pour le Var). La comparaison compte ↔ liste officielle
--         étant une égalité, ces comptes sont signalés « CFEI introuvable » dans l'admin.
-- Après : la liste officielle est stockée sous forme canonique (import : canonicalNumeroCfei,
--         api-express/src/utils/numero-cfei.ts) ; le numéro saisi par le chasseur (User.numero_cfei)
--         n'est jamais modifié, il est ramené à la forme canonique au moment de la comparaison.
--         Ce script rattrape les lignes déjà importées, avec la même règle :
--         - CFEI : `CFEI-<dép sans zéro de tête, 2 car. min.>-<AA>-<numéro sans zéro de tête>`,
--           préfixe ajouté s'il manque ;
--         - FREI : `<dép>-FREI-<AA>-<numéro>`, seuls séparateurs et casse nettoyés ;
--         - autre texte : tirets typographiques remplacés, espaces retirés, majuscules.
--         Garder cette fonction alignée sur canonicalNumeroCfei.
--
-- À exécuter UNE FOIS, manuellement, sur la base (preprod puis prod), au déploiement de la PR,
-- AVANT de relancer l'import de la liste officielle (scripts/import-official-cfei.ts).

BEGIN;

CREATE FUNCTION pg_temp.canonical_numero_cfei(source text) RETURNS text
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  cleaned text;
  tokens text;
  m text[];
  departement text;
BEGIN
  cleaned := regexp_replace(upper(regexp_replace(source, '[‐-―−]', '-', 'g')), '^\s+|\s+$', '', 'g');
  tokens := regexp_replace(regexp_replace(regexp_replace(cleaned, '[\s_./]+', '-', 'g'), '-+', '-', 'g'), '^-|-$', '', 'g');

  m := regexp_match(tokens, '^(?:CFEI)?-?(\d{1,3}|0?2[AB])-(\d{2})-(\d+)$');
  IF m IS NOT NULL THEN
    departement := regexp_replace(m[1], '^0+(?=.)', '');
    IF length(departement) < 2 THEN
      departement := lpad(departement, 2, '0');
    END IF;
    RETURN 'CFEI-' || departement || '-' || m[2] || '-' || regexp_replace(m[3], '^0+(?=.)', '');
  END IF;

  m := regexp_match(tokens, '^(\d{1,3}|0?2[AB])-?FREI-?(\d{2})-(\d+)$');
  IF m IS NOT NULL THEN
    RETURN m[1] || '-FREI-' || m[2] || '-' || m[3];
  END IF;

  RETURN regexp_replace(cleaned, '\s+', '', 'g');
END;
$$;

-- numero_cfei est la clé. Quand plusieurs lignes donnent la même forme canonique,
-- on garde celle déjà canonique, sinon la plus récente.
DELETE FROM "OfficialCfei" o
USING (
  SELECT numero_cfei,
         row_number() OVER (
           PARTITION BY pg_temp.canonical_numero_cfei(numero_cfei)
           ORDER BY (numero_cfei = pg_temp.canonical_numero_cfei(numero_cfei)) DESC, updated_at DESC
         ) AS rang
  FROM "OfficialCfei"
) doublons
WHERE o.numero_cfei = doublons.numero_cfei
  AND doublons.rang > 1;

UPDATE "OfficialCfei"
SET numero_cfei = pg_temp.canonical_numero_cfei(numero_cfei),
    updated_at = now()
WHERE numero_cfei <> pg_temp.canonical_numero_cfei(numero_cfei);

COMMIT;
