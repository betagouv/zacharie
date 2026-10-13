// Le pull delta (GET /carcasse) ne renvoie que les carcasses du périmètre de l'utilisateur. Une
// carcasse qui en sort (correction de données en base, rattachement retiré…) n'est donc jamais
// renvoyée, et la copie locale du client reste figée. Un client dont le dernier pull est antérieur
// à cette date reçoit tout son périmètre et remplace ses carcasses locales au lieu de les merger.
// À avancer après chaque correction de données faite directement en base.
export const FORCE_FULL_RELOAD_AFTER = new Date('2026-09-29T13:02:00.000Z');
