import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { trackPageView, setCustomDimensions } from '../services/matomo';
import useUser from '../zustand/user';

export function MatomoTracker() {
  const location = useLocation();
  const user = useUser((state) => state.user);

  useEffect(() => {
    setCustomDimensions(user ? { isZacharieAdmin: user.isZacharieAdmin } : null);
    trackPageView(location.pathname + location.search, document.title);
  }, [location, user]);

  return null;
}
