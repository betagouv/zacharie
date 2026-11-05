import { describe, expect, it } from 'vitest';
import { utils } from '@e965/xlsx';
import { parseCcgSheet } from './parse-ccg-sheet';

const RESYTAL_HEADERS = [
  'Établissement :\r\nSIRET/NUMAGRIT',
  'Établissement :\nEnseigne usuelle\n(RESYTAL)',
  ' Unité Activité (UA) :\r\nIdentifier métier (Type : Valorisation)',
  ' Unité Activité (UA) :\r\nAdresse de localisation :\r\nConcaténations des lignes adresses 1, 2 & 3',
  "Unité d'Activité (UA) :\nCode postal\n(Adresse de localisation)",
  'Unité Activité (UA) :\nAdresse de localisation :\nCommune Nom',
];
const RESYTAL_SHORT_HEADERS = [
  'Etb_SIRET_NUMAGRIT',
  'Etb_Enseigne_Usuelle_Resytal',
  'UA_IdentifiantsMetiers',
  'UA_Adr_Loc_Concat_Ligne',
  'UA_Adr_Loc_CodePostal',
  'UA_Adr_Loc_Commune_Nom',
];
const RESYTAL_ROWS = [
  [
    '77616003800035',
    'FEDER DEP CHASSEURS DES P O',
    '|CCG:66-CCG-3|LIBRE:66-CCG-03|',
    ' Route nationale 116 ',
    '66800',
    'ERR',
  ],
  ['12345678900011', 'Sans numéro', '||', '1 rue du Bois', '09000', 'FOIX'],
];

const expected = [
  {
    numero_ddecpp: '66-CCG-3',
    nom_d_usage: 'FEDER DEP CHASSEURS DES P O',
    address_ligne_1: 'Route nationale 116',
    address_ligne_2: '',
    code_postal: '66800',
    ville: 'ERR',
    siret: '77616003800035',
  },
];

describe('parseCcgSheet', () => {
  it('lit un export RESYTAL avec les en-têtes en ligne 5', () => {
    const sheet = utils.aoa_to_sheet([
      [''],
      ['Données rafraîchies le : ...'],
      ['Les réponses aux invites : ...'],
      ['N.B. : ...'],
      RESYTAL_HEADERS,
      RESYTAL_SHORT_HEADERS,
      ...RESYTAL_ROWS,
    ]);
    expect(parseCcgSheet(sheet)).toEqual(expected);
  });

  it('lit un export RESYTAL avec les en-têtes en ligne 6', () => {
    const sheet = utils.aoa_to_sheet([
      [''],
      ['Données rafraîchies le : ...'],
      ['Les réponses aux invites : ...'],
      ['N.B. : ...'],
      ['N.B. : La deuxième ligne d’en-tête ...'],
      RESYTAL_HEADERS,
      RESYTAL_SHORT_HEADERS,
      ...RESYTAL_ROWS,
    ]);
    expect(parseCcgSheet(sheet)).toEqual(expected);
  });

  it('lit un fichier simple avec les en-têtes en ligne 1', () => {
    const sheet = utils.aoa_to_sheet([
      ['numero_ddecpp', 'nom_d_usage', 'code_postal'],
      ['01-CCG-1', 'CCG Ain', '01000'],
    ]);
    expect(parseCcgSheet(sheet)).toEqual([
      {
        numero_ddecpp: '01-CCG-1',
        nom_d_usage: 'CCG Ain',
        address_ligne_1: '',
        address_ligne_2: '',
        code_postal: '01000',
        ville: '',
        siret: '',
      },
    ]);
  });

  it('renvoie une liste vide sans colonne de numéro DDECPP', () => {
    const sheet = utils.aoa_to_sheet([
      ['Nom', 'Ville'],
      ['CCG', 'FOIX'],
    ]);
    expect(parseCcgSheet(sheet)).toEqual([]);
  });
});
