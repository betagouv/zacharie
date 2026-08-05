import { describe, test, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { CarcasseType } from '@prisma/client';
import {
  matchBrucellose,
  matchPestePorcine,
  matchTuberculose,
  matchTularemie,
  REFERENTIEL_CANONICALS,
  type CarcasseLike,
} from '~/utils/disease-suspicions';

const REFERENTIEL_DIR = path.resolve(__dirname, '../../../app-local-first-react-router/src/data/anomalies');

type ReferentielSection = {
  site: string | null;
  anomalies: Array<{ intitule: string }>;
};

function canonicalsOf(fichier: string): string[] {
  const sections: ReferentielSection[] = JSON.parse(
    fs.readFileSync(path.join(REFERENTIEL_DIR, fichier), 'utf8')
  );
  return sections.flatMap((section) =>
    section.anomalies.map((a) => (section.site ? `${a.intitule} - ${section.site}` : a.intitule))
  );
}

function carcasse(overrides: Partial<CarcasseLike> = {}): CarcasseLike {
  return {
    type: CarcasseType.GROS_GIBIER,
    espece: 'Sanglier',
    examinateur_anomalies_carcasse: [],
    examinateur_anomalies_abats: [],
    ...overrides,
  };
}

// Le mapping maladie ↔ anomalie repose sur des valeurs exactes du référentiel. Si une
// anomalie est renommée côté front sans être répercutée ici, la détection s'éteindrait
// en silence : ce test est le garde-fou.
describe('cohérence avec le référentiel', () => {
  test('toutes les anomalies surveillées existent encore dans gros.json', () => {
    const existantes = canonicalsOf('gros.json');
    for (const canonical of REFERENTIEL_CANONICALS.gros) {
      expect(existantes, `« ${canonical} » a disparu du référentiel gros gibier`).toContain(canonical);
    }
  });

  test('toutes les anomalies surveillées existent encore dans petit.json', () => {
    const existantes = canonicalsOf('petit.json');
    for (const canonical of REFERENTIEL_CANONICALS.petit) {
      expect(existantes, `« ${canonical} » a disparu du référentiel petit gibier`).toContain(canonical);
    }
  });
});

describe('matchTuberculose', () => {
  test('abcès sur les abats', () => {
    expect(
      matchTuberculose(
        carcasse({ examinateur_anomalies_abats: ['Abcès - Système respiratoire (trachée, poumons)'] })
      )
    ).toBe(true);
    expect(
      matchTuberculose(
        carcasse({ examinateur_anomalies_abats: ['Abcès - Système digestif (foie, intestins)'] })
      )
    ).toBe(true);
  });

  test('ganglions volumineux', () => {
    expect(
      matchTuberculose(
        carcasse({
          examinateur_anomalies_abats: [
            'Ganglions volumineux (intestins) - Système digestif (foie, intestins)',
          ],
        })
      )
    ).toBe(true);
  });

  test('abcès à l’examen externe', () => {
    expect(matchTuberculose(carcasse({ examinateur_anomalies_carcasse: ['Abcès unique - Externe'] }))).toBe(
      true
    );
  });

  test('une anomalie bénigne ne déclenche rien', () => {
    expect(matchTuberculose(carcasse({ examinateur_anomalies_carcasse: ['Tiques - Externe'] }))).toBe(false);
  });

  test('ne concerne pas le petit gibier', () => {
    expect(
      matchTuberculose(
        carcasse({ type: CarcasseType.PETIT_GIBIER, examinateur_anomalies_carcasse: ['Abcès'] })
      )
    ).toBe(false);
  });

  test('une saisie libre suffixée par la famille ne déclenche rien', () => {
    expect(
      matchTuberculose(
        carcasse({ examinateur_anomalies_abats: ['abcès suspect - Système digestif (foie, intestins)'] })
      )
    ).toBe(false);
  });
});

describe('matchPestePorcine', () => {
  test('lésions hémorragiques et cœur anormal, sur sanglier', () => {
    for (const anomalie of [
      'Lésions hémorragiques - Système respiratoire (trachée, poumons)',
      'Lésions hémorragiques - Système digestif (foie, intestins)',
      'Cœur anormal - Système circulatoire (cœur)',
    ]) {
      expect(matchPestePorcine(carcasse({ examinateur_anomalies_abats: [anomalie] })), anomalie).toBe(true);
    }
  });

  test('même anomalie sur une autre espèce : pas de suspicion', () => {
    expect(
      matchPestePorcine(
        carcasse({
          espece: 'Cerf élaphe',
          examinateur_anomalies_abats: ['Cœur anormal - Système circulatoire (cœur)'],
        })
      )
    ).toBe(false);
  });
});

describe('matchBrucellose', () => {
  test('testicules anormaux sur petit gibier à poils', () => {
    expect(
      matchBrucellose(
        carcasse({
          type: CarcasseType.PETIT_GIBIER,
          espece: 'Lièvres',
          examinateur_anomalies_carcasse: ['Testicules gonflés ou consistance anormale'],
        })
      )
    ).toBe(true);
  });

  test('petit gibier à plumes exclu', () => {
    expect(
      matchBrucellose(
        carcasse({
          type: CarcasseType.PETIT_GIBIER,
          espece: 'Pigeons',
          examinateur_anomalies_carcasse: ['Testicules gonflés ou consistance anormale'],
        })
      )
    ).toBe(false);
  });
});

describe('matchTularemie', () => {
  test('anomalies déclenchantes sur lièvre', () => {
    for (const anomalie of [
      'Abcès',
      "Déformation d'une ou plusieurs articulations",
      'Déformation de la tête',
    ]) {
      expect(
        matchTularemie(
          carcasse({
            type: CarcasseType.PETIT_GIBIER,
            espece: 'Lièvres',
            examinateur_anomalies_carcasse: [anomalie],
          })
        ),
        anomalie
      ).toBe(true);
    }
  });

  test('lapin exclu (lièvres uniquement)', () => {
    expect(
      matchTularemie(
        carcasse({
          type: CarcasseType.PETIT_GIBIER,
          espece: 'Lapins',
          examinateur_anomalies_carcasse: ['Abcès'],
        })
      )
    ).toBe(false);
  });
});
