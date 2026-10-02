import { describe, it, expect } from 'vitest';
import { confirmPushedItems } from './confirm-pushed-items';

type Item = { id: string; value: string; is_synced: boolean; updated_at: Date };

const idKey = (i: Item) => i.id;
const pushedAt = new Date('2026-01-01T10:00:00Z');

function item(id: string, overrides: Partial<Item> = {}): Item {
  return { id, value: 'local', is_synced: false, updated_at: pushedAt, ...overrides };
}

describe('confirmPushedItems', () => {
  it('replaces a pushed item, unchanged since, by the server copy marked synced', () => {
    const local = item('a');
    const saved = item('a', { value: 'server', updated_at: new Date('2026-01-01T10:00:05Z') });
    const next = confirmPushedItems({
      localItems: { a: local },
      pushedItems: [local],
      savedItems: [saved],
      idKey,
    });
    expect(next.a.value).toBe('server');
    expect(next.a.is_synced).toBe(true);
  });

  it('keeps a pushed item edited again since the push, still unsynced', () => {
    const pushed = item('a');
    const editedAgain = item('a', { value: 'local 2', updated_at: new Date('2026-01-01T10:00:01Z') });
    const saved = item('a', { value: 'server' });
    const next = confirmPushedItems({
      localItems: { a: editedAgain },
      pushedItems: [pushed],
      savedItems: [saved],
      idKey,
    });
    expect(next.a.value).toBe('local 2');
    expect(next.a.is_synced).toBe(false);
  });

  it('keeps a pushed item absent from the response unsynced', () => {
    const local = item('a');
    const next = confirmPushedItems({
      localItems: { a: local },
      pushedItems: [local],
      savedItems: [],
      idKey,
    });
    expect(next.a).toBe(local);
  });

  it('ignores saved items that were not pushed or are not in the local store', () => {
    const local = item('a');
    const next = confirmPushedItems({
      localItems: { a: local },
      pushedItems: [item('b')],
      savedItems: [item('a', { value: 'server' }), item('b', { value: 'server' })],
      idKey,
    });
    expect(next).toEqual({ a: local });
  });
});
