import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { trackPageView, setCustomDimensions, trackClick } from '../services/matomo';
import useUser from '../zustand/user';
import { scrubString } from '../utils/scrub-sensitive';

export function MatomoTracker() {
  const location = useLocation();
  const user = useUser((state) => state.user);

  useEffect(() => {
    setCustomDimensions(user ? { isZacharieAdmin: user.isZacharieAdmin, roles: user.roles } : null);
    trackPageView(scrubString(location.pathname + location.search), document.title);
  }, [location, user]);

  useEffect(() => {
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
