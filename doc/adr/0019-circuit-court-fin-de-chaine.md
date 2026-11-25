# 0019. Circuit court : fin de chaîne passive

## Contexte

Le commerce de détail (ou un autre destinataire du circuit court) reçoit les carcasses directement du premier détenteur. Il n'y a ni prise en charge dans Zacharie, ni inspection SVI (voir CLAUDE.md).

## Décision

- Le destinataire circuit court ne prend jamais en charge : `current_owner_role` reste `PREMIER_DETENTEUR`, seul `next_owner_role` pointe vers lui. La carcasse est « Transmise » et ne progresse plus ; la vente est clôturée dès l'envoi (`intermediaire_closed_at`, `isCarcasseDone` dans `api-express/src/utils/is-carcasse-done.ts` et `app-local-first-react-router/src/utils/is-carcasse-done.ts`, même critère que `notifyCircuitCourt`). Pour lui, la fiche est toujours clôturée.
- Ce lot clôturé ne verrouille pas la fiche : le premier détenteur répartit encore les autres carcasses.
- Pas d'étape « Transport » en circuit court (le stockage est la dernière étape).
- Vue en lecture seule : pas de « Transmettre », pas de sélecteur, pas d'« Enregistrer » / « Modifier ». Une seule route de transmission (`getCircuitCourtFeiUrl`, `api-express/src/utils/fei-url.ts`). Le backend doit refuser ou ignorer ses écritures : avec un chargement « carcasse d'abord », c'est la seule garde.
- Le taux de saisie n'a pas de sens en circuit court dans les stats fédérations (circuit `nonAgree`, voir [0031](0031-statistiques-et-saisons.md)).
- Côté admin, la prise en charge n'est attendue que hors circuit court.
- Une vente au circuit court qui contient du sanglier déclenche la trichine côté premier détenteur.
- Vérification de remise (voir [0029](0029-notifications-et-emails.md)) : si l'email n'a pas atteint le destinataire, l'expéditeur est prévenu.

## Conséquences

- Ne pas ajouter d'action d'écriture à l'espace circuit court (e2e `98-readonly-enforcement`).
- Ne jamais déduire un statut circuit court d'un `current_owner_role` du destinataire : il n'existe pas.
