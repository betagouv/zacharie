import useZustandStore, { syncData } from '@app/zustand/store';
import { useEffect, useRef, useState } from 'react';

export function useIsOnline() {
  const [isOnline, setIsOnline] = useState(true);
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

  return isOnline;
}
