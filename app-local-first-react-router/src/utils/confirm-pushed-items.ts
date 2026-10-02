interface PushedItem {
  updated_at: Date;
  is_synced: boolean;
}

// Après un POST /sync réussi, la copie renvoyée par le serveur remplace la copie locale (is_synced =
// true) — sauf si l'item a encore été modifié localement depuis l'envoi : cette modification plus
// récente reste non synchronisée et partira à la prochaine synchro. Un item envoyé mais absent de la
// réponse (refusé ou en erreur) reste non synchronisé.
export function confirmPushedItems<T extends PushedItem>({
  localItems,
  pushedItems,
  savedItems,
  idKey,
}: {
  localItems: Record<string, T>;
  pushedItems: Array<T>;
  savedItems: Array<T>;
  idKey: (item: T) => string;
}): Record<string, T> {
  const pushedUpdatedAt = new Map(
    pushedItems.map((item) => [idKey(item), new Date(item.updated_at).getTime()])
  );
  const nextItems = { ...localItems };
  for (const savedItem of savedItems) {
    const id = idKey(savedItem);
    const localItem = localItems[id];
    if (!localItem || !pushedUpdatedAt.has(id)) continue;
    if (new Date(localItem.updated_at).getTime() !== pushedUpdatedAt.get(id)) continue;
    nextItems[id] = { ...savedItem, is_synced: true };
  }
  return nextItems;
}
