import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router';

/**
 * Global scroll reset on navigation.
 *
 * We navigate via pushState (no full page reload), so the scroll position of
 * the previous page leaks into the next one. This resets it to the top on
 * forward navigations (clicking a Link, programmatic navigate, REPLACE).
 *
 * On POP (browser back/forward, navigate(-1)) we deliberately do NOTHING so the
 * per-page scroll restoration (useSaveScroll on the fiches/carcasses lists) and
 * the browser's native restoration can put the user back where they were.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();
  useEffect(() => {
    if (navigationType !== 'POP') {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [pathname, navigationType]);
  return null;
}
