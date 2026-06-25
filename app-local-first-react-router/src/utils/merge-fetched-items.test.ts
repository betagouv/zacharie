import { describe, it, expect } from 'vitest';
import { mergeItems } from './merge-fetched-items';

type Item = {
  id: string;
  value: string;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date | null;
  is_synced?: boolean;
};

const idKey = (i: Item) => i.id;

function item(overrides: Partial<Item> = {}): Item {
  return {
    id: 'a',
    value: 'server',
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
    deleted_at: null,
    is_synced: true,
    ...overrides,
  };
}

describe('mergeItems', () => {
  it('la version serveur gagne quand le local est synchronisé', () => {
    const oldItems = [item({ id: 'a', value: 'local', is_synced: true })];
    const newItems = [item({ id: 'a', value: 'server', is_synced: true })];
    const merged = mergeItems({ oldItems, newItems, idKey }) as Record<string, Item>;
    expect(merged['a'].value).toBe('server');
  });

  // Régression : un ré-envoi de carcasse pose une modif locale non synchronisée et plus récente.
  // Un pull concurrent (qui revoit encore l'ancien état serveur, donc plus ancien) ne doit PAS
  // écraser cette modif, sinon le ré-envoi est perdu et la carcasse reste bloquée chez le premier
  // détenteur.
  it('ne pas écraser un item local non synchronisé PLUS RÉCENT que le serveur', () => {
    const oldItems = [
      item({ id: 'a', value: 'local-non-synced', is_synced: false, updated_at: new Date('2026-03-02') }),
    ];
    const newItems = [
      item({ id: 'a', value: 'server-stale', is_synced: true, updated_at: new Date('2026-03-01') }),
    ];
    const merged = mergeItems({ oldItems, newItems, idKey }) as Record<string, Item>;
    expect(merged['a'].value).toBe('local-non-synced');
    expect(merged['a'].is_synced).toBe(false);
  });

  // Après un push réussi, le serveur a rattrapé (updated_at serveur >= local) : on accepte la
  // version serveur pour que is_synced repasse à true (sinon l'item resterait « dirty » à jamais).
  it('accepter la version serveur quand elle a rattrapé un local non synchronisé', () => {
    const oldItems = [
      item({ id: 'a', value: 'local-non-synced', is_synced: false, updated_at: new Date('2026-03-01') }),
    ];
    const newItems = [
      item({ id: 'a', value: 'server-caught-up', is_synced: true, updated_at: new Date('2026-03-02') }),
    ];
    const merged = mergeItems({ oldItems, newItems, idKey }) as Record<string, Item>;
    expect(merged['a'].value).toBe('server-caught-up');
    expect(merged['a'].is_synced).toBe(true);
  });

  it('ne pas supprimer un item local non synchronisé plus récent que la suppression serveur', () => {
    const oldItems = [
      item({ id: 'a', value: 'local-non-synced', is_synced: false, updated_at: new Date('2026-03-02') }),
    ];
    const newItems = [item({ id: 'a', value: 'server', deleted_at: new Date('2026-03-01') })];
    const merged = mergeItems({ oldItems, newItems, idKey }) as Record<string, Item>;
    expect(merged['a']).toBeDefined();
    expect(merged['a'].value).toBe('local-non-synced');
  });

  it('un item supprimé côté serveur est retiré du merge (cas synchronisé)', () => {
    const oldItems = [item({ id: 'a', value: 'local', is_synced: true })];
    const newItems = [item({ id: 'a', deleted_at: new Date('2026-02-01') })];
    const merged = mergeItems({ oldItems, newItems, idKey }) as Record<string, Item>;
    expect(merged['a']).toBeUndefined();
  });

  it('conserve les items locaux absents de la réponse serveur', () => {
    const oldItems = [item({ id: 'a', value: 'local-a' }), item({ id: 'b', value: 'local-b' })];
    const newItems = [item({ id: 'a', value: 'server-a' })];
    const merged = mergeItems({ oldItems, newItems, idKey }) as Record<string, Item>;
    expect(merged['a'].value).toBe('server-a');
    expect(merged['b'].value).toBe('local-b');
  });

  it('ajoute les nouveaux items serveur', () => {
    const oldItems: Item[] = [];
    const newItems = [item({ id: 'c', value: 'server-c' })];
    const merged = mergeItems({ oldItems, newItems, idKey }) as Record<string, Item>;
    expect(merged['c'].value).toBe('server-c');
  });
});
