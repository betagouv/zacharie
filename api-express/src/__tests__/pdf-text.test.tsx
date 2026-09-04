import React from 'react';
import { describe, test, expect, vi } from 'vitest';
import { Document, Page, Text, View, renderToBuffer } from '@react-pdf/renderer';
import { extractPdfText, normalizePdfText } from '~/utils/pdf-text';
import { extractPoolReferences } from '~/utils/trichine-inbound-email';

// Lecture du texte des rapports COFRAC : c'est elle qui décide du rattachement au pool.

vi.mock('~/third-parties/sentry', () => ({ capture: vi.fn() }));

describe('normalizePdfText', () => {
  test('recolle une référence fragmentée par l’extracteur', () => {
    expect(normalizePdfText('Référence client : P- 26- 000045')).toBe('Référence client : P-26-000045');
    expect(extractPoolReferences(normalizePdfText('pool P -26 -000045 négatif'))).toEqual(['P-26-000045']);
  });
  test('normalise les espaces', () => {
    expect(normalizePdfText('  Rapport\n\n  COFRAC \t ')).toBe('Rapport COFRAC');
  });
});

describe('extractPdfText', () => {
  test('lit la référence de pool dans un vrai PDF', async () => {
    const buffer = await renderToBuffer(
      <Document>
        <Page size="A4">
          <View>
            <Text>Rapport d'analyse — recherche de trichine</Text>
            <Text>Référence client : P-26-000045</Text>
            <Text>Résultat : NEGATIF</Text>
          </View>
        </Page>
      </Document>
    );

    const text = await extractPdfText(buffer);

    expect(text).toContain('P-26-000045');
    expect(extractPoolReferences(text!)).toEqual(['P-26-000045']);
  }, 30000);

  test('renvoie null sur un fichier illisible (scan sans texte, PDF corrompu)', async () => {
    expect(await extractPdfText(Buffer.from('pas un pdf'))).toBeNull();
  });
});
