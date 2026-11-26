# 0018. Pré-enregistrement des destinataires et classification par Albert

## Contexte

Un destinataire (commerce de détail, restaurant, collecteur…) ne s'inscrit pas lui-même. Le chasseur ne connaît pas la typologie réglementaire. Il ne doit pas pouvoir savoir si un partenaire existe déjà (ni qui le livre).

## Décision

- `api-express/src/utils/create-destinataire.ts` (`createDestinataire`, `classifyAndNotify`) : un chasseur, un ETG ou un admin pré-enregistre le destinataire avec le compte de son représentant, qui reçoit une invitation. Un chasseur peut aussi pré-enregistrer un collecteur pro. Côté API, seul le premier détenteur (ou l'admin) ajoute un destinataire : l'ETG et le collecteur ne transmettent pas au circuit court (403 pour un non-chasseur). Un destinataire enregistré devient un partenaire (relation créée).
- Le chasseur dit seulement « particulier » ou « professionnel » et décrit librement le professionnel. Albert (`classifyDestinataire`, `utils/classify-destinataire.ts`) choisit parmi `CLASSIFIABLE_TYPES` ; une réponse qui n'est pas exactement une catégorie attendue laisse `CIRCUIT_COURT`. La classification tourne après la réponse HTTP ; l'équipe est prévenue une fois le type connu. Le représentant a un seul rôle, égal au type de son entité : la classification change les deux.
- Anti-doublons : recherche par SIRET normalisé, sinon raison sociale + code postal, quel que soit le type saisi. Un SIRET porté par une entité qui ne reçoit pas de carcasses (CCG, SVI, association) est une erreur de saisie : pas de doublon. Email vérifié libre avant de créer l'entité. Un utilisateur existant sans rôle est réutilisé.
- Partenaire existant : on le rattache et on répond exactement comme une création ; le contact saisi est ignoré ; l'équipe est prévenue, jamais le chasseur.
- Saisie côté app (`src/components/PartenaireNouveau.tsx`, `routes/admin/entity-nouvelle.tsx`) : saisie complète aidée par l'annuaire des entreprises (`src/services/recherche-entreprises.ts` : API publique sans clé, entreprises en activité, adresse découpée, saisie manuelle possible hors ligne ou sur quota). Le SIRET vient de l'annuaire. Établissements de l'annuaire préfixés pour les reconnaître. Champs adresse / SIRET non contrôlés, remontés par une `key` à chaque préremplissage. La saisie devient la raison sociale au fil de la frappe (sur mobile, react-select quitte le champ après le choix). Admin : 300 ms de pause et annulation de la requête précédente ; destinataires existants en suggestions.
- `InputDestinataire` : une correspondance trouvée seulement par tolérance aux fautes laisse la possibilité de créer.

## Conséquences

- Ne pas exposer de différence de réponse entre création et rattachement.
- Le consommateur final n'est pas une entité et n'est jamais proposé.
