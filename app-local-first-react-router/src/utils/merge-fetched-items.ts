type PossibleIdKeys =
  | 'zacharie_carcasse_id'
  | 'fei_numero__bracelet__intermediaire_id'
  | 'numero'
  | 'etg_id_entity_id';

interface ItemBase {
  deleted_at: Date | null;
}

interface MergeParams<T extends ItemBase> {
  oldItems: T[];
  newItems: T[];
  idKey: PossibleIdKeys;
}

export function mergeItems<T extends ItemBase>({ oldItems, newItems, idKey }: MergeParams<T>) {
  const newItemsCleanedAndFormatted = [];
  const newItemIds = {};

  for (const newItem of newItems) {
    // @ts-expect-error idKey is not a property of T
    newItemIds[newItem[idKey]] = true;
    if (newItem.deleted_at) continue;
    newItemsCleanedAndFormatted.push(newItem);
  }

  const oldItemsPurged = [];
  for (const oldItem of oldItems) {
    if (oldItem.deleted_at) continue;
    // @ts-expect-error idKey is not a property of T
    if (!newItemIds[oldItem[idKey]]) {
      oldItemsPurged.push(oldItem);
    }
  }

  return [...oldItemsPurged, ...newItemsCleanedAndFormatted];
}
