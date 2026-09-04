import { describe, test, expect } from 'vitest';
import { TrichineResultatAnalyse } from '@prisma/client';
import {
  findResultSegments,
  parseTrichineReport,
  traduireVerdictLaboratoire,
} from '~/utils/trichine-report-parse';
import { normalizeLimsValue } from '~/utils/lims-mapping';
import { RAPPORT_LVD_NEGATIF } from './fixtures/rapport-lvd-lda39';

// Lecture du verdict dans un rapport COFRAC : c'est ce qui évite au labo de ressaisir son résultat.
// Le contrat épinglé ici est autant ce qu'on lit que ce qu'on refuse de conclure.

describe('libellé de résultat', () => {
  test('lit un résultat négatif', () => {
    const parsed = parseTrichineReport('Rapport n°42\nRésultat : Négatif\nMéthode : digestion');
    expect(parsed.resultat).toBe(TrichineResultatAnalyse.NEGATIF);
    expect(parsed.source).toBe('LIBELLE_RESULTAT');
    expect(parsed.ambigu).toBe(false);
  });

  test('« non négatif » n’est pas « négatif »', () => {
    const parsed = parseTrichineReport('Conclusion : résultat non négatif');
    expect(parsed.resultat).toBe(TrichineResultatAnalyse.NON_NEGATIF);
  });

  test('lit un douteux, un positif, une analyse impossible', () => {
    expect(parseTrichineReport('Résultat : douteux').resultat).toBe(TrichineResultatAnalyse.DOUTEUX);
    expect(parseTrichineReport('Résultat : POSITIF').resultat).toBe(TrichineResultatAnalyse.POSITIF);
    expect(parseTrichineReport('Résultat : analyse impossible').resultat).toBe(
      TrichineResultatAnalyse.ANALYSE_IMPOSSIBLE
    );
  });

  test('comprend les formulations métier', () => {
    expect(
      parseTrichineReport("Conclusion : absence de larves de Trichine dans l'échantillon").resultat
    ).toBe(TrichineResultatAnalyse.NEGATIF);
    expect(parseTrichineReport('Résultat : présence de larves de Trichinella spiralis').resultat).toBe(
      TrichineResultatAnalyse.POSITIF
    );
  });

  test('lit le verdict sans libellé quand le texte ne porte qu’un seul résultat', () => {
    const parsed = parseTrichineReport(
      "Recherche de Trichinella par digestion artificielle.\nL'analyse est négative."
    );
    expect(parsed.resultat).toBe(TrichineResultatAnalyse.NEGATIF);
    expect(parsed.source).toBe('TEXTE_COMPLET');
  });
});

describe('ce qu’on refuse de conclure', () => {
  test('une légende qui cite tous les verdicts ne donne rien', () => {
    const parsed = parseTrichineReport('Résultats possibles : négatif / douteux / positif');
    expect(parsed.resultat).toBeNull();
    expect(parsed.ambigu).toBe(true);
  });

  test('deux verdicts dans le texte, sans libellé, ne donnent rien', () => {
    const parsed = parseTrichineReport(
      "Recherche de trichine. L'analyse est négative. En cas de résultat non négatif, le laboratoire transmet l'échantillon au LNR."
    );
    expect(parsed.resultat).toBeNull();
    expect(parsed.ambigu).toBe(true);
    expect(parsed.source).toBe('TEXTE_COMPLET');
  });

  test('le libellé prime sur la mention type qui l’entoure', () => {
    const parsed = parseTrichineReport(
      "Résultat : négatif. En cas de résultat non négatif, le laboratoire transmet l'échantillon au LNR."
    );
    expect(parsed.resultat).toBe(TrichineResultatAnalyse.NEGATIF);
    expect(parsed.source).toBe('LIBELLE_RESULTAT');
  });

  test('un rapport sans verdict lisible ne donne rien, sans être ambigu', () => {
    const parsed = parseTrichineReport('Rapport d’essai n°2026-1234 — laboratoire départemental');
    expect(parsed.resultat).toBeNull();
    expect(parsed.ambigu).toBe(false);
  });
});

describe('détails', () => {
  test('extrait le parasite identifié', () => {
    const parsed = parseTrichineReport('Résultat : non négatif — parasite identifié : Trichinella britovi');
    expect(parsed.resultat).toBe(TrichineResultatAnalyse.NON_NEGATIF);
    expect(parsed.parasite_identifie).toBe('trichinella britovi');
  });

  test('extrait la référence interne du laboratoire', () => {
    const parsed = parseTrichineReport('Référence dossier : LVD44-2026-0987\nRésultat : négatif');
    expect(parsed.reference_labo).toBe('lvd44-2026-0987');
  });

  test('découpe les libellés de résultat', () => {
    expect(findResultSegments(normalizeLimsValue('Résultat : négatif. Méthode : digestion'))).toEqual([
      'negatif',
    ]);
  });
});

describe('rapport LVD réel', () => {
  test('lit le négatif porté par « Commentaires », malgré la légende des codes', () => {
    const parsed = parseTrichineReport(RAPPORT_LVD_NEGATIF);

    expect(parsed.resultat).toBe(TrichineResultatAnalyse.NEGATIF);
    expect(parsed.source).toBe('LIBELLE_RESULTAT');
    expect(parsed.ambigu).toBe(false);
  });

  test('la légende des codes, seule, ne donne rien', () => {
    const legende =
      '"neg" = négatif "NON_NEG" = non négatif "QI" = quantité insuffisante "INI" = ininterprétable "NC" = non conforme';

    expect(parseTrichineReport(legende).resultat).toBeNull();
    expect(parseTrichineReport(legende).ambigu).toBe(true);
  });

  test('« larves non détectées » est un négatif, « larves détectées » un positif', () => {
    expect(parseTrichineReport('Résultat : larves non détectées').resultat).toBe(
      TrichineResultatAnalyse.NEGATIF
    );
    expect(parseTrichineReport('Résultat : larves détectées').resultat).toBe(TrichineResultatAnalyse.POSITIF);
  });
});

describe('traduireVerdictLaboratoire', () => {
  // Les LVD écrivent « non négatif » quand ils ont détecté une larve ; Zacharie appelle ça DOUTEUX
  // et réserve NON_NEGATIF au LNR (cf doc/trichine.md §2).
  test('tout constat non négatif d’un LVD vaut DOUTEUX', () => {
    for (const lu of [
      TrichineResultatAnalyse.NON_NEGATIF,
      TrichineResultatAnalyse.POSITIF,
      TrichineResultatAnalyse.PRESENCE_PARASITE_NON_IDENTIFIE,
    ]) {
      expect(traduireVerdictLaboratoire(lu, false)).toBe(TrichineResultatAnalyse.DOUTEUX);
    }
  });

  test('un négatif de LVD reste un négatif', () => {
    expect(traduireVerdictLaboratoire(TrichineResultatAnalyse.NEGATIF, false)).toBe(
      TrichineResultatAnalyse.NEGATIF
    );
  });

  test('le LNR conclut dans le vocabulaire de Zacharie, rien n’est traduit', () => {
    expect(traduireVerdictLaboratoire(TrichineResultatAnalyse.NON_NEGATIF, true)).toBe(
      TrichineResultatAnalyse.NON_NEGATIF
    );
    expect(traduireVerdictLaboratoire(TrichineResultatAnalyse.POSITIF, true)).toBe(
      TrichineResultatAnalyse.POSITIF
    );
  });
});
