import useZustandStore from '@app/zustand/store';
import { syncData } from '@app/utils/sync-data';
import { useEffect, useRef, useState } from 'react';

export function useIsOnline() {
  const [_isOnline, setIsOnline] = useState(true);
  // Treat local `npm run dev` as always-online for dev ergonomics, but NOT under Playwright,
  // where e2e specs simulate offline/online via context.setOffline and need the real state.
  // const isOnline = import.meta.env.DEV && import.meta.env.VITE_TEST_PLAYWRIGHT !== 'true' ? true : _isOnline;
  const isOnline = _isOnline;
  const veryBadConnection = useRef(false);
  useEffect(() => {
    function handleOnline(event: Event) {
      if (event.type === 'good-connection') {
        veryBadConnection.current = false;
      }
      if (!isOnline) {
        navigator.serviceWorker?.controller?.postMessage('SW_MESSAGE_BACK_TO_ONLINE');
        setIsOnline(true);
        useZustandStore.setState({ isOnline: true });
        syncData('is-online');
      }
    }
    function handleOffline(event: Event) {
      if (event.type === 'very-bad-connection') {
        veryBadConnection.current = true;
      }
      setIsOnline(false);
    }
    setIsOnline(veryBadConnection.current ? false : navigator.onLine);
    window.addEventListener('online', handleOnline);
    window.addEventListener('good-connection', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('very-bad-connection', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('good-connection', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('very-bad-connection', handleOffline);
    };
  }, [isOnline]);

  useEffect(() => {
    useZustandStore.setState({ isOnline });
  }, [isOnline]);

  console.log('isOnline', isOnline);

  return isOnline;
}
