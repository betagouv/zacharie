import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { trackPageView } from '../services/matomo';

export function MatomoTracker() {
  const location = useLocation();

  useEffect(() => {
    // Track page view on route change
    trackPageView(location.pathname + location.search, document.title);
  }, [location]);

  return null;
}
