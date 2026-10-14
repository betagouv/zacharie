import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { trackPageView, setCustomDimensions, trackClick } from '../services/matomo';
import useUser from '../zustand/user';

export function MatomoTracker() {
  const location = useLocation();
  const user = useUser((state) => state.user);

  useEffect(() => {
    setCustomDimensions(user ? { isZacharieAdmin: user.isZacharieAdmin, roles: user.roles } : null);
    trackPageView(location.pathname + location.search, document.title);
  }, [location, user]);

  useEffect(() => {
    // capture : le clic est compté même si le bouton stoppe la propagation
    const onClick = (event: MouseEvent) => {
      const element = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-matomo]');
      if (element) {
        trackClick(element);
      }
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  return null;
}
