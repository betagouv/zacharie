-- Répare les carcasses restées au stade examinateur (current_owner_role = EXAMINATEUR_INITIAL)
-- mais portant un current_owner_entity_id.
--
-- Contexte : une carcasse ajoutée par l'examinateur APRÈS que la fiche a été transmise reste
-- orpheline au stade examinateur. Une propagation d'ownership fiche -> carcasses lui a estampillé
-- un current_owner_entity_id (l'entité aval, ex. ETG) sans mettre à jour le rôle. Or l'examinateur
-- initial est TOUJOURS une personne, jamais une entité : ce entity_id est incohérent et faisait
-- basculer la fiche en « à compléter » chez l'entité aval via isCarcasseUnderMyResponsability.
--
-- Effet : on remet current_owner_entity_id / current_owner_entity_name_cache à NULL. Le rôle et le
-- current_owner_user_id (l'examinateur) restent inchangés — la carcasse reste correctement chez
-- l'examinateur. updated_at = NOW() force les clients local-first à re-synchroniser les lignes.
--
-- À exécuter UNE FOIS, manuellement (prod puis preprod). Lancer d'abord le SELECT d'aperçu.

-- Aperçu des lignes concernées (attendu : ~5 lignes)
SELECT zacharie_carcasse_id,
       fei_numero,
       current_owner_role,
       current_owner_user_id,
       current_owner_entity_id,
       current_owner_entity_name_cache
FROM "Carcasse"
WHERE current_owner_role = 'EXAMINATEUR_INITIAL'
  AND current_owner_entity_id IS NOT NULL
  AND deleted_at IS NULL
ORDER BY fei_numero, created_at;

BEGIN;

UPDATE "Carcasse"
SET current_owner_entity_id = NULL,
    current_owner_entity_name_cache = NULL,
    updated_at = NOW()
WHERE current_owner_role = 'EXAMINATEUR_INITIAL'
  AND current_owner_entity_id IS NOT NULL
  AND deleted_at IS NULL;

COMMIT;
