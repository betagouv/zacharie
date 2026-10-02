// Exécute les tâches d'une même clé l'une après l'autre, dans l'ordre d'arrivée. Les tâches de
// clés différentes restent parallèles. Une tâche en échec ne bloque pas les suivantes.
// Le verrou vit dans la mémoire du processus : il ne sérialise que les requêtes reçues par la même
// instance de l'API.
export function createKeyedMutex() {
  const tails = new Map<string, Promise<void>>();

  function runExclusive<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = tails.get(key) ?? Promise.resolve();
    const result = previous.then(task);
    const tail = result.then(
      () => undefined,
      () => undefined
    );
    tails.set(key, tail);
    tail.then(() => {
      if (tails.get(key) === tail) tails.delete(key);
    });
    return result;
  }

  return { runExclusive, pendingKeys: () => tails.size };
}
