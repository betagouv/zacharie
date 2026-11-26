import { describe, test, expect } from 'vitest';
import { canonicalNumeroCfei } from '~/utils/numero-cfei';
import { extractOfficialCfeisFromSheet, findOfficialCfeiColumns } from '~/utils/official-cfei-sheet';

describe('canonicalNumeroCfei', () => {
  test.each([
    ['CFEI-45-13-577', 'CFEI-45-13-577'],
    ['CFEI-45-13-0577', 'CFEI-45-13-577'],
    ['CFEI-45-13-00577', 'CFEI-45-13-577'],
    ['cfei-45-13-577', 'CFEI-45-13-577'],
    [' CFEI-45-13-577 ', 'CFEI-45-13-577'],
    ['CFEI 45-13-0577', 'CFEI-45-13-577'],
    ['CFEI45-13-577', 'CFEI-45-13-577'],
    ['CFEI - 45 - 13 - 577', 'CFEI-45-13-577'],
    ['CFEI/45/13/577', 'CFEI-45-13-577'],
    ['CFEI.45.13.0577', 'CFEI-45-13-577'],
    ['CFEI\t45-13-0577\n', 'CFEI-45-13-577'],
    // un espace sépare toujours deux groupes : un groupe coupé n'est pas reconnu, plutôt que rattaché à un autre numéro
    ['CFEI-21-09-1 234', 'CFEI-21-09-1-234'],
    ['CFEI-45-13-577 2', 'CFEI-45-13-577-2'],
    ['CFEI-2 1-09-5', 'CFEI-2-1-09-5'],
    // tirets typographiques (onglet Corrèze)
    ['CFEI\u201019\u201012\u20100345', 'CFEI-19-12-345'],
    ['CFEI\u201319\u221212\u20140345', 'CFEI-19-12-345'],
    // département sur 3 chiffres ou sur 1
    ['CFEI-056-24-123', 'CFEI-56-24-123'],
    ['CFEI-5-14-0012', 'CFEI-05-14-12'],
    ['CFEI-971-20-0001', 'CFEI-971-20-1'],
    ['CFEI-2A-15-0042', 'CFEI-2A-15-42'],
    // sans préfixe (onglet Var)
    ['83-07-132', 'CFEI-83-07-132'],
    // FREI gardé tel quel
    ['32-FREI-20-002', '32-FREI-20-002'],
    ['32\u2011frei\u201120\u2011002', '32-FREI-20-002'],
    // texte libre : nettoyé seulement
    ['en cours', 'EN-COURS'],
    ['ABC-12', 'ABC-12'],
  ])('%s → %s', (input, expected) => {
    expect(canonicalNumeroCfei(input)).toBe(expected);
  });

  test('espaces insécables et fines : traités comme des espaces', () => {
    expect(canonicalNumeroCfei('CFEI\u00A045-13-0577')).toBe('CFEI-45-13-577');
    expect(canonicalNumeroCfei('CFEI\u202F45-13-0577\u00A0')).toBe('CFEI-45-13-577');
    expect(canonicalNumeroCfei('\uFEFFCFEI-45-13-0577')).toBe('CFEI-45-13-577');
  });

  test.each([
    'CFEI-21-09-0 5',
    'CFEI-21-09-02 045',
    'CFEI-0 45-13-577',
    ' CFEI 45 13 0577 ',
    'en cours',
    '02A-FREI-20-002',
    '83-07-132',
  ])('idempotente : %s', (input) => {
    const canonique = canonicalNumeroCfei(input);
    expect(canonicalNumeroCfei(canonique)).toBe(canonique);
  });

  test('les variantes de zéros de tête donnent la même forme', () => {
    const variants = ['CFEI-45-13-577', 'CFEI-045-13-0577', 'cfei 45 13 00577'];
    expect(new Set(variants.map(canonicalNumeroCfei)).size).toBe(1);
  });
});

const TITRE = ["LISTE DES PERSONNES FORMEES A L'EXAMEN INITIAL"];

describe('findOfficialCfeiColumns', () => {
  test('mise en page courante : titre, département, puis NOM | Prénom | Numéro d’attestation', () => {
    const columns = findOfficialCfeiColumns([
      TITRE,
      ['Département : Aube'],
      ['NOM', 'Prénom', "Numéro d'attestation", 'Adresse'],
    ]);
    expect(columns).toEqual({
      headerRowIndex: 2,
      numero: 2,
      nom: 0,
      prenom: 1,
      nomPrenom: null,
      departement: null,
    });
  });

  test('Haute-Marne : CIVILITE en tête, colonne « CFEI »', () => {
    const columns = findOfficialCfeiColumns([TITRE, [], ['CIVILITE', 'NOM', 'PRENOM', 'CFEI']]);
    expect(columns).toMatchObject({ numero: 3, nom: 1, prenom: 2 });
  });

  test('Vosges : « n° d’agrément » en première colonne', () => {
    const columns = findOfficialCfeiColumns([TITRE, [], ["n° d'agrément", '', 'Civilité', 'Nom', 'Prénom']]);
    expect(columns).toMatchObject({ numero: 0, nom: 3, prenom: 4 });
  });

  test('nom et prénom dans une seule colonne', () => {
    expect(findOfficialCfeiColumns([['NOM \u2013 Prénom', "Numéro d'attestation"]])).toMatchObject({
      numero: 1,
      nom: null,
      nomPrenom: 0,
    });
    expect(findOfficialCfeiColumns([['NOM Prénom', "Numéro d'attestation"]])).toMatchObject({ nomPrenom: 0 });
  });

  test('le numéro du formateur ne remplace pas celui de la personne formée', () => {
    const columns = findOfficialCfeiColumns([
      ['NOM', 'Prénom', "Numéro d'attestation", 'Formateur', 'N° attestation formateur'],
    ]);
    expect(columns?.numero).toBe(2);
  });

  test('aucun en-tête reconnu', () => {
    expect(findOfficialCfeiColumns([TITRE, ['Nom', 'Adresse']])).toBeNull();
  });
});

describe('extractOfficialCfeisFromSheet', () => {
  test('extrait, canonise et compte les lignes ignorées', () => {
    const result = extractOfficialCfeisFromSheet('19', [
      TITRE,
      ['Département : Corrèze'],
      ['NOM', 'Prénom', "Numéro d'attestation"],
      ['DUPONT', 'Jean', 'CFEI\u201019\u201012\u20100345'],
      ['MARTIN', 'Paul', ''],
      ['DURAND', 'Luc', 'en cours'],
      ['', '', ''],
    ]);
    expect(result.error).toBeNull();
    expect(result.rowsRead).toBe(3);
    expect(result.records).toEqual([
      { numero_cfei: 'CFEI-19-12-345', nom: 'DUPONT', prenom: 'Jean', departement: '19' },
    ]);
    expect(result.skipped).toEqual({ 'numéro vide': 1, 'numéro au format inconnu': 1 });
  });

  test('onglet régional : département déduit du numéro', () => {
    const result = extractOfficialCfeisFromSheet('Région Grand Est (08, 10, 51)', [
      ['NOM', 'Prénom', "Numéro d'attestation"],
      ['DUPONT', 'Jean', 'CFEI-08-08-2285'],
      ['MARTIN', 'Paul', '51-FREI-20-001'],
    ]);
    expect(result.records.map((r) => r.departement)).toEqual(['08', '51']);
  });

  test('Var : numéros sans préfixe', () => {
    const result = extractOfficialCfeisFromSheet('83', [
      ['NOM', 'Prénom', "Numéro d'attestation"],
      ['DUPONT', 'Jean', '83-07-132'],
    ]);
    expect(result.records[0].numero_cfei).toBe('CFEI-83-07-132');
  });

  test('nom et prénom dans une seule colonne → rangés dans nom', () => {
    const result = extractOfficialCfeisFromSheet('27', [
      ['NOM \u2013 Prénom', "Numéro d'attestation"],
      ['DUPONT Jean', 'CFEI-27-10-0001'],
    ]);
    expect(result.records[0]).toMatchObject({ nom: 'DUPONT Jean', prenom: null });
  });

  test('Ain : colonne du numéro vide → onglet signalé', () => {
    const result = extractOfficialCfeisFromSheet('01', [
      ['NOM', 'Prénom', "Numéro d'attestation"],
      ['DUPONT', 'Jean', ''],
      ['MARTIN', 'Paul', ''],
    ]);
    expect(result.records).toEqual([]);
    expect(result.error).toBe('aucun numéro exploitable');
    expect(result.skipped).toEqual({ 'numéro vide': 2 });
  });

  test('pas d’en-tête → onglet signalé', () => {
    expect(extractOfficialCfeisFromSheet('X', [['a', 'b']]).error).toBe('colonne du numéro introuvable');
  });
});
