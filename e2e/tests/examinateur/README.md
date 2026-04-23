# Examinateur specs — Section A (scenarios 1–23)

Each spec file is prefixed with its scenario number from
`/Users/arnaudambroselli/.claude/plans/adaptive-purring-crayon.md`.

Mobile viewport (350x667). `resetDb('EXAMINATEUR_INITIAL')` in `beforeAll`/`beforeEach`.

## Index

- 01 — Création fiche grand gibier mono-carcasse — `01-creation-fiche-grand-gibier-mono.spec.ts`
- **02 — Création fiche grand gibier multi-carcasses (4 daims)** — existing: `fiche_circuit-long_simple_examinateur.spec.ts`
- 03 — Création fiche petit gibier en lot (pigeons x10) — `03-creation-fiche-petit-gibier-lot.spec.ts`
- 04 — Création fiche mixte (3 daims + 10 pigeons) — `04-creation-fiche-mixte.spec.ts`
- 05 — Anomalies abats + carcasse — `05-creation-fiche-anomalies.spec.ts`
- 06 — Brouillon : quitter puis reprendre — `06-brouillon-persistance.spec.ts`
- 07 — Edition carcasse depuis détail — `07-edition-carcasse-depuis-detail.spec.ts`
- 08 — Examinateur == PD via CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY — `08-examinateur-pd-self-handoff.spec.ts`
- 09 — Onboarding complet — `09-onboarding-complet.spec.ts`
- 10 — Onboarding incomplet : accès restreint — `10-onboarding-incomplet-acces-restreint.spec.ts`
- 11 — Onboarding partiel : formation manquante — `11-onboarding-partiel-formation-manquante.spec.ts`
- 12 — Profil examinateur — `12-profil-examinateur.spec.ts`
- 13 — CCG : création depuis profil — `13-ccg-creation-profil.spec.ts`
- 14 — Edition CCG — `14-ccg-edition.spec.ts`
- 15 — Fiche clôturée SVI : vue chasseur — `15-fiche-svi-cloturee-vue-chasseur.spec.ts`
- 16 — Fiche livrée circuit court : vue chasseur — `16-fiche-circuit-court-livree-vue-chasseur.spec.ts`
- 17 — Fiche refusée intégralement par ETG — `17-fiche-refusee-par-etg-vue-chasseur.spec.ts`
- 18 — Date de mise à mort future refusée — `18-date-future-refusee.spec.ts`
- 19 — Heure éviscération < mise à mort — `19-heure-eviscération-invalide.spec.ts`
- 20 — Retirer une carcasse ajoutée — `20-retirer-carcasse.spec.ts`
- 21 — 0 carcasse → Transmettre désactivé — `21-zero-carcasse-transmettre-disabled.spec.ts`
- 22 — Double-clic "Transmettre" — `22-double-clic-transmettre.spec.ts`
- 23 — Déconnexion en plein formulaire — `23-deconnexion-pendant-formulaire.spec.ts`
