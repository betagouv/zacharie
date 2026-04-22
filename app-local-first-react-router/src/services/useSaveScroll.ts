import { useEffect } from 'react';

export const FORCE_SCROLL_TOP_FLAG = 'force-scroll-top-on-next-mount';

export function useSaveScroll(propId: string) {
  useEffect(() => {
    const id = `${propId}-scrollY`;
    function handleScrollEnd() {
      window.sessionStorage.setItem(id, window.scrollY.toString());
    }
    const forceTop = window.sessionStorage.getItem(FORCE_SCROLL_TOP_FLAG);
    const savedScrollY = window.sessionStorage.getItem(id);
    if (forceTop) {
      window.sessionStorage.removeItem(FORCE_SCROLL_TOP_FLAG);
      window.sessionStorage.removeItem(id);
      window.scrollTo({ top: 0, behavior: 'instant' });
    } else if (savedScrollY) {
      window.scrollTo({
        top: parseInt(savedScrollY, 10),
        behavior: 'instant',
      });
    } else {
      window.scrollTo({
        top: 0,
        behavior: 'instant',
      });
    }
    window.addEventListener('scrollend', handleScrollEnd);
    return () => {
      window.removeEventListener('scrollend', handleScrollEnd);
    };
  }, []);
}
