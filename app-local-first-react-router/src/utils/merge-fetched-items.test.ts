import { describe, it, expect } from 'vitest';
import { mergeItems } from './merge-fetched-items';

type Item = {
  id: string;
  value: string;
  is_synced: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date | null;
};

function item(id: string, overrides: Partial<Item> = {}): Item {
  return {
    id,
    value: 'server',
    is_synced: true,
    created_at: new Date('2026-01-01'),
    updated_at: new Date('2026-01-01'),
    deleted_at: null,
    ...overrides,
  };
}

const idKey = (i: Item) => i.id;
const keepUnsynced = (i: Item) => !i.is_synced;

describe('mergeItems', () => {
  it('server wins by default, even over an unsynced local item', () => {
    const merged = mergeItems({
      oldItems: [item('a', { value: 'local', is_synced: false })],
      newItems: [item('a')],
      idKey,
    }) as Record<string, Item>;
    expect(merged.a.value).toBe('server');
  });

  it('keeps the local item when keepOldItem returns true', () => {
    const merged = mergeItems({
      oldItems: [item('a', { value: 'local', is_synced: false })],
      newItems: [item('a')],
      idKey,
      keepOldItem: keepUnsynced,
    }) as Record<string, Item>;
    expect(merged.a.value).toBe('local');
    expect(merged.a.is_synced).toBe(false);
  });

  it('takes the server item when keepOldItem returns false', () => {
    const merged = mergeItems({
      oldItems: [item('a', { value: 'local', is_synced: true })],
      newItems: [item('a')],
      idKey,
      keepOldItem: keepUnsynced,
    }) as Record<string, Item>;
    expect(merged.a.value).toBe('server');
  });

  it('drops the local item when the server deleted it, even if keepOldItem returns true', () => {
    const merged = mergeItems({
      oldItems: [item('a', { value: 'local', is_synced: false })],
      newItems: [item('a', { deleted_at: new Date('2026-01-02') })],
      idKey,
      keepOldItem: keepUnsynced,
    }) as Record<string, Item>;
    expect(merged.a).toBeUndefined();
  });

  it('keeps local items absent from the server response and adds new server items', () => {
    const merged = mergeItems({
      oldItems: [item('a', { value: 'local' }), item('b', { value: 'local', is_synced: false })],
      newItems: [item('c')],
      idKey,
      keepOldItem: keepUnsynced,
    }) as Record<string, Item>;
    expect(Object.keys(merged).sort()).toEqual(['a', 'b', 'c']);
    expect(merged.a.value).toBe('local');
    expect(merged.b.value).toBe('local');
  });

  it('drops locally deleted items', () => {
    const merged = mergeItems({
      oldItems: [item('a', { deleted_at: new Date('2026-01-02') })],
      newItems: [],
      idKey,
    }) as Record<string, Item>;
    expect(merged.a).toBeUndefined();
  });
});
