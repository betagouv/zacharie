/* eslint-disable @typescript-eslint/no-explicit-any */
import { type UseStore, set, get, createStore, keys, delMany } from 'idb-keyval';
import { capture } from '@app/services/sentry';

export const currentCacheKey = 'zach-last-refresh-2024-11-25';
const dbName = 'keyval-store';
const storeName = 'keyval';

let customStore: UseStore | null = null;
// const savedCacheKey = window.localStorage.getItem("zach-currentCacheKey");
// if (savedCacheKey !== currentCacheKey) {
//   clearCache("savedCacheKey diff currentCacheKey");
// } else {
if (typeof window !== 'undefined') {
  setupDB();
}
// }

function setupDB() {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem('zach-currentCacheKey', currentCacheKey);
  customStore = createStore(dbName, storeName);
}

async function deleteDB() {
  // On n'arrive pas à supprimer la base de données, on va donc supprimer les données une par une
  if (!customStore) {
    return;
  }
  const ks = await keys(customStore);
  return await delMany(ks, customStore);
}

// Le JWT natif joue le rôle du cookie de session web : clearCache ne le supprime pas, c'est
// disconnect() qui l'efface. Le connect-as garde ainsi le jeton qu'il vient de recevoir.
export const NATIVE_TOKEN_KEY = 'zacharie_native_jwt';

function getClearableLocalStorageKeys() {
  const storage = window.localStorage;
  if (!storage) return [];
  const clearableKeys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key !== null && key !== NATIVE_TOKEN_KEY) clearableKeys.push(key);
  }
  return clearableKeys;
}

// Résout toujours (false après 10 tentatives) pour ne jamais bloquer une déconnexion.
export async function clearCache(calledFrom = 'not defined', iteration = 0): Promise<boolean> {
  console.log(`clearing cache from ${calledFrom}, iteration ${iteration}`);
  if (iteration > 10) {
    capture(new Error('Failed to clear cache'), { extra: { calledFrom } });
    setupDB();
    return false;
  }
  await deleteDB().catch(console.error);
  console.log('clearing localStorage');
  for (const key of getClearableLocalStorageKeys()) {
    window.localStorage.removeItem(key);
  }

  console.log('cleared localStorage');
  // window.sessionStorage?.clear();

  // wait 200ms to make sure the cache is cleared
  await new Promise((resolve) => setTimeout(resolve, 200));

  // Check if the cache is empty
  const remainingLocalStorageKeys = getClearableLocalStorageKeys();
  const localStorageEmpty = remainingLocalStorageKeys.length === 0;
  // const sessionStorageEmpty = window.sessionStorage.length === 0;
  const indexedDBEmpty = customStore ? (await keys(customStore)).length === 0 : true;
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.controller?.postMessage('SW_MESSAGE_CLEAR_CACHE');
  }
  // if (localStorageEmpty && sessionStorageEmpty && indexedDBEmpty) {
  if (localStorageEmpty && indexedDBEmpty) {
    setupDB();
    return true;
  }
  if (!localStorageEmpty) {
    console.log(`localStorage not empty ${remainingLocalStorageKeys[0]}`);
  }
  // if (!sessionStorageEmpty) console.log("sessionStorage not empty");
  if (!indexedDBEmpty) {
    console.log('indexedDB not empty');
  }
  // If the cache is not empty, try again
  return clearCache('try again clearCache', iteration + 1);
}

type CacheKeys = 'user' | 'feis';

export async function setCacheItem(key: CacheKeys, value: unknown) {
  if (customStore === null) {
    return null;
  }
  try {
    if (customStore) {
      await set(key, value, customStore);
    }
  } catch (error: any) {
    if (error instanceof Error && error?.message?.includes('connection is closing')) {
      // Si on a une erreur de type "connection is closing", on va essayer de réinitialiser
      // la connexion à la base de données et de sauvegarder la donnée à nouveau
      setupDB();
      try {
        await set(key, value, customStore);
      } catch (error: any) {
        capture(error, { tags: { key } });
        return;
      }
    }
    capture(error, { tags: { key } });
  }
}

export async function getCacheItem(key: CacheKeys) {
  if (customStore === null) {
    return null;
  }
  try {
    const data = await get(key, customStore);
    return data;
  } catch (error: any) {
    if (error instanceof Error && error?.message?.includes('connection is closing')) {
      // Si on a une erreur de type "connection is closing", on va essayer de réinitialiser
      // la connexion à la base de données et de récupérer la donnée à nouveau
      setupDB();
      try {
        const data = await get(key, customStore);
        return data;
      } catch (error: any) {
        capture(error, { tags: { key } });
        return null;
      }
    }
    capture(error, { tags: { key } });
    return null;
  }
}

export async function getCacheItemDefaultValue(key: CacheKeys, defaultValue: unknown) {
  const storedValue = await getCacheItem(key);
  return storedValue || defaultValue;
}
