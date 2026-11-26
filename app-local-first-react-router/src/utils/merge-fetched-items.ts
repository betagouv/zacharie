interface ItemBase {
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date | null;
}

interface MergeParams<T extends ItemBase> {
  oldItems: T[];
  newItems: T[];
  idKey: (item: T) => string;
}

export function mergeItems<T extends ItemBase>({ oldItems, newItems, idKey }: MergeParams<T>) {
  const toReturn = {};
  const newItemIds = {};
  const newItemIdsDeleted = {};

  for (const newItem of newItems) {
    // @ts-expect-error idKey is not a property of T
    newItemIds[idKey(newItem)] = true;
    if (newItem.deleted_at) {
      // @ts-expect-error idKey is not a property of T
      newItemIdsDeleted[idKey(newItem)] = true;
      continue;
    }
    // @ts-expect-error idKey is not a property of T
    toReturn[idKey(newItem)] = newItem;
  }

  for (const oldItem of oldItems) {
    if (oldItem.deleted_at) continue;
    // if the item is deleted in the new items, skip it
    // @ts-expect-error idKey is not a property of T
    if (newItemIdsDeleted[idKey(oldItem)]) continue;
    // @ts-expect-error idKey is not a property of T
    const fetchedItem = toReturn[idKey(oldItem)];
    // Une ligne reçue identique à la copie locale (marge du delta) garde la référence locale : le
    // stockage local n'écrit que les enregistrements dont la référence change.
    if (!fetchedItem || JSON.stringify(fetchedItem) === JSON.stringify(oldItem)) {
      // @ts-expect-error idKey is not a property of T
      toReturn[idKey(oldItem)] = oldItem;
    }
  }

  return toReturn;
}
