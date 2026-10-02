import { describe, test, expect } from 'vitest';
import { createKeyedMutex } from '~/utils/keyed-mutex';

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('createKeyedMutex', () => {
  test('les tâches de la même clé ne se chevauchent pas et gardent leur ordre', async () => {
    const { runExclusive } = createKeyedMutex();
    const events: Array<string> = [];
    const first = deferred();

    const p1 = runExclusive('user-1', async () => {
      events.push('start-1');
      await first.promise;
      events.push('end-1');
      return 1;
    });
    const p2 = runExclusive('user-1', async () => {
      events.push('start-2');
      return 2;
    });

    await flush();
    expect(events).toEqual(['start-1']);

    first.resolve();
    expect(await p1).toBe(1);
    expect(await p2).toBe(2);
    expect(events).toEqual(['start-1', 'end-1', 'start-2']);
  });

  test('les tâches de clés différentes tournent en parallèle', async () => {
    const { runExclusive } = createKeyedMutex();
    const events: Array<string> = [];
    const first = deferred();

    const p1 = runExclusive('user-1', async () => {
      events.push('start-1');
      await first.promise;
    });
    const p2 = runExclusive('user-2', async () => {
      events.push('start-2');
    });

    await p2;
    expect(events).toEqual(['start-1', 'start-2']);
    first.resolve();
    await p1;
  });

  test('une tâche en échec rejette son appelant sans bloquer la suivante', async () => {
    const { runExclusive } = createKeyedMutex();

    const p1 = runExclusive('user-1', async () => {
      throw new Error('boom');
    });
    const p2 = runExclusive('user-1', async () => 'ok');

    await expect(p1).rejects.toThrow('boom');
    expect(await p2).toBe('ok');
  });

  test('la clé est libérée une fois la file vide', async () => {
    const { runExclusive, pendingKeys } = createKeyedMutex();

    const p1 = runExclusive('user-1', async () => {});
    const p2 = runExclusive('user-1', async () => {
      throw new Error('boom');
    });
    expect(pendingKeys()).toBe(1);

    await p1;
    await expect(p2).rejects.toThrow('boom');
    await flush();
    expect(pendingKeys()).toBe(0);
  });
});
