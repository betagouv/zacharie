/* eslint-disable @typescript-eslint/no-explicit-any */
import { type UseStore, set, get, createStore, keys, delMany } from 'idb-keyval';
import { capture } from '@app/services/sentry';

const dbName = 'keyval-store';
const storeName = 'keyval';

let customStore: UseStore | null = null;
if (typeof window !== 'undefined') {
  setupDB();
}

function setupDB() {
  if (typeof window === 'undefined') {
    return;
  }
  customStore = createStore(dbName, storeName);
}

async function deleteDB() {
  if (!customStore) {
    return;
  }
  const ks = await keys(customStore);
  return await delMany(ks, customStore);
}

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

  await new Promise((resolve) => setTimeout(resolve, 200));

  const remainingLocalStorageKeys = getClearableLocalStorageKeys();
  const localStorageEmpty = remainingLocalStorageKeys.length === 0;
  const indexedDBEmpty = customStore ? (await keys(customStore)).length === 0 : true;
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.controller?.postMessage('SW_MESSAGE_CLEAR_CACHE');
  }
  if (localStorageEmpty && indexedDBEmpty) {
    setupDB();
    return true;
  }
  if (!localStorageEmpty) {
    console.log(`localStorage not empty ${remainingLocalStorageKeys[0]}`);
  }
  if (!indexedDBEmpty) {
    console.log('indexedDB not empty');
  }
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
      setupDB();
      try {
        await set(key, value, customStore);
      } catch (error: any) {
        capture(error, { tags: { key } });
      }
      return;
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
