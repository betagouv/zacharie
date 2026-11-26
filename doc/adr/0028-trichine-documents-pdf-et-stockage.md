# 0028. Trichine : documents, PDF de FTP et stockage Cellar

## Contexte

Les PDF de FTP, les rapports d'analyse (COFRAC) et les photographies de larves doivent être conservés et servis avec les droits de l'objet. Le stockage est Cellar (Clever Cloud, compatible S3, §12 de [trichine.md](../trichine.md)), absent en dev et en CI.

## Décision

- `api-express/src/third-parties/cellar.ts` : `IS_CELLAR_CONFIGURED` faux en dev / test / CI ; les appelants régénèrent alors à la volée. `us-east-1` n'est qu'un prérequis de signature. Clé `trichine/{type}/{annee}/{id-document}.{ext}`. `getFromCellar` renvoie null si l'objet n'existe pas ; toute autre erreur remonte en 502.
- `utils/trichine-document-upload.ts` : la clé est toujours calculée par le serveur depuis l'id du document (un client pourrait sinon rattacher la clé d'un autre laboratoire). Fichier en base64 dans le JSON, corps plafonné à 5 Mo dans `index.ts`, donc `MAX_UPLOAD_BYTES` = 3,5 Mo. Octets magiques vérifiés (`SIGNATURES`) ; table extension → content type pour servir.
- Documents servis par l'API (pas d'URL publique), avec les droits du pool ; seulement s'ils sont rattachés à l'objet demandé. Un échantillon retiré garde ses documents téléchargeables mais n'en accepte plus. Photos de larves : déposées par le LVD sur la FTP de confirmation, une par requête (plusieurs photos de 3,5 Mo dépasseraient la taille d'un appel), lues par le LNR. Le nom d'origine d'un rapport n'est pas gardé. Dépôts limités en débit par utilisateur.
- PDF de FTP (`utils/trichine-ftp-document.ts`, `templates/get-ftp-pdf.tsx`) : figé et archivé à l'envoi, document de référence de ce qui est parti. `archiveFtpPdf` renvoie le buffer même en cas d'échec de stockage (l'envoi ne doit pas échouer). Au téléchargement, version archivée, sinon génération à la volée. Projection identique à celle du labo ; nombre de larves LVD seulement sur une FTP de confirmation. Code-barres Code 128 lisible par les douchettes LIMS, `paddingwidth: 10` pour la zone silencieuse ISO/IEC 15417.
- `getEtgsDuServiceExpediteur` (`utils/trichine-parties.ts`) : en circuit agréé, le SVI expédie depuis l'atelier auquel il est rattaché (`Entity.etg_linked_to_svi_id`).
- Côté app : l'URL du blob d'aperçu est libérée à toute fermeture de la modale ou au remplacement.

## Conséquences

- Ne jamais accepter un chemin de stockage venu du client.
- Les transactions Sentry portent le body : sans `beforeSendTransaction`, un fichier partirait en entier (voir [0035](0035-observabilite-sentry-matomo-donnees-personnelles.md)).
