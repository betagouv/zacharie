interface ItemBase {
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date | null;
  is_synced?: boolean;
}

interface MergeParams<T extends ItemBase> {
  oldItems: T[];
  newItems: T[];
  idKey: (item: T) => string;
}

const time = (d?: Date | string | null) => (d ? new Date(d).getTime() : 0);

export function mergeItems<T extends ItemBase>({ oldItems, newItems, idKey }: MergeParams<T>) {
  const toReturn = {};
  const newItemIdsDeleted = {};

  const oldById: Record<string, T> = {};
  for (const oldItem of oldItems) {
    oldById[idKey(oldItem)] = oldItem;
  }

  for (const newItem of newItems) {
    const id = idKey(newItem);
    const local = oldById[id];
    // Local-first : une modif locale non encore poussée (`is_synced === false`) et PLUS RÉCENTE
    // que la version serveur est la source de vérité — le pull ne doit pas l'écraser, sinon il
    // efface une édition en attente (ex. un ré-envoi de carcasse poussé en concurrence d'un pull
    // qui revoit encore l'ancien état serveur). Dès que le serveur a rattrapé (`updated_at` serveur
    // >= local), on accepte la version serveur et `is_synced` repasse naturellement à true.
    if (local && local.is_synced === false && time(local.updated_at) > time(newItem.updated_at)) {
      continue;
    }
    if (newItem.deleted_at) {
      // @ts-expect-error idKey is not a property of T
      newItemIdsDeleted[id] = true;
      continue;
    }
    // @ts-expect-error idKey is not a property of T
    toReturn[id] = newItem;
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
