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
    if (!toReturn[idKey(oldItem)]) {
      // @ts-expect-error idKey is not a property of T
      toReturn[idKey(oldItem)] = oldItem;
    }
  }

  return toReturn;
}
