import { describe, it, expect } from 'vitest';
import { mergeItems } from './merge-fetched-items';

type Item = { id: string; value: string; created_at: Date; updated_at: Date; deleted_at: Date | null };

const item = (id: string, value: string, updatedAt = 1000, deletedAt: number | null = null): Item => ({
  id,
  value,
  created_at: new Date(500),
  updated_at: new Date(updatedAt),
  deleted_at: deletedAt === null ? null : new Date(deletedAt),
});

const merge = (oldItems: Array<Item>, newItems: Array<Item>) =>
  mergeItems({ oldItems, newItems, idKey: (i) => i.id }) as Record<string, Item>;

describe('mergeItems', () => {
  it('garde la référence locale quand la ligne reçue est identique', () => {
    const local = item('a', 'x');
    const result = merge([local], [item('a', 'x')]);
    expect(result.a).toBe(local);
  });

  it('garde la référence locale quand les dates locales sont des chaînes ISO', () => {
    const local = { ...item('a', 'x'), updated_at: new Date(1000).toISOString() } as unknown as Item;
    const result = merge([local], [item('a', 'x')]);
    expect(result.a).toBe(local);
  });

  it('prend la ligne reçue quand son contenu diffère, même à updated_at égal', () => {
    const fetched = item('a', 'corrigée');
    const result = merge([item('a', 'x')], [fetched]);
    expect(result.a).toBe(fetched);
  });

  it('prend la ligne reçue quand elle est plus récente', () => {
    const fetched = item('a', 'x', 2000);
    const result = merge([item('a', 'x')], [fetched]);
    expect(result.a).toBe(fetched);
  });

  it('retire une ligne supprimée sur le serveur', () => {
    const result = merge([item('a', 'x'), item('b', 'y')], [item('a', 'x', 2000, 2000)]);
    expect(Object.keys(result)).toEqual(['b']);
  });

  it('ignore une suppression reçue pour une ligne absente en local', () => {
    const local = item('a', 'x');
    const result = merge([local], [item('z', 'x', 2000, 2000)]);
    expect(result).toEqual({ a: local });
  });
});
