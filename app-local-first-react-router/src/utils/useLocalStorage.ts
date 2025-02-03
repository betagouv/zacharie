import { useLocalStorageValue } from '@react-hookz/web';

export const useLocalStorage = <T>(key: string, defaultValue: T) => {
  const { value, set, remove } = useLocalStorageValue<T>(key, {
    defaultValue,
  });
  return [value, set, remove];
};
