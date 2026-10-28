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
    // les jetons d'invitation / de réinitialisation et les emails passent en paramètre d'URL
    trackPageView(scrubString(location.pathname + location.search), document.title);
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
