import { describe, expect, it } from 'vitest';
import { DELTA_MARGIN_MS, dropMarginOverwrites, getDeltaAfter } from './delta-margin';

const cursor = new Date('2026-11-09T10:00:00.000Z').getTime();
type Item = { id: string; updated_at: Date; is_synced: boolean; value: string };
const item = (id: string, updatedAt: number, is_synced: boolean, value: string): Item => ({
  id,
  updated_at: new Date(updatedAt),
  is_synced,
  value,
});
const run = (fetched: Array<Item>, local: Array<Item>, lastUpdateFromServer = cursor) =>
  dropMarginOverwrites({
    fetched,
    local: Object.fromEntries(local.map((i) => [i.id, i])),
    lastUpdateFromServer,
    idKey: (i) => i.id,
  });

describe('getDeltaAfter', () => {
  it('demande tout le périmètre au premier chargement', () => {
    expect(getDeltaAfter(0)).toBe(0);
  });
  it('recule le curseur de la marge', () => {
    expect(getDeltaAfter(cursor)).toBe(cursor - DELTA_MARGIN_MS);
  });
});

describe('dropMarginOverwrites', () => {
  it('garde une ligne écrite en base avant le curseur mais jamais reçue (commit tardif)', () => {
    const fetched = [item('a', cursor - 3000, true, 'corrigée')];
    expect(run(fetched, [item('a', cursor - 60_000, true, 'ancienne')])).toEqual(fetched);
  });

  it("n'écrase pas une modification locale pas encore envoyée avec une ligne revenue par la marge", () => {
    const fetched = [item('a', cursor - 3000, true, 'serveur')];
    expect(run(fetched, [item('a', cursor + 5000, false, 'locale')])).toEqual([]);
  });

  it('laisse passer une ligne que le dernier /sync vient d’écrire, même si la copie locale est non synchronisée', () => {
    const fetched = [item('a', cursor + 1000, true, 'serveur')];
    expect(run(fetched, [item('a', cursor + 500, false, 'locale')])).toEqual(fetched);
  });

  it('laisse passer une ligne absente du store local', () => {
    const fetched = [item('b', cursor - 3000, true, 'nouvelle')];
    expect(run(fetched, [])).toEqual(fetched);
  });

  it('ne filtre rien au premier chargement', () => {
    const fetched = [item('a', cursor - 3000, true, 'serveur')];
    expect(run(fetched, [item('a', cursor, false, 'locale')], 0)).toEqual(fetched);
  });
});
