import useZustandStore from '@app/zustand/store';
import { useEffect, useRef, useState } from 'react';

export function useIsOnline() {
  const [isOnline, setIsOnline] = useState(true);
  const veryBadConnection = useRef(false);
  useEffect(() => {
    console.log('POPOPOPO');
    function handleOnline(event: Event) {
      console.log(event.type);
      if (event.type === 'good-connection') {
        veryBadConnection.current = false;
      }
      // console.log({ isOnline });
      if (!isOnline) {
        navigator.serviceWorker?.controller?.postMessage('SW_MESSAGE_BACK_TO_ONLINE');
        setIsOnline(true);
      }
    }
    function handleOffline(event: Event) {
      console.log(event.type);
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
