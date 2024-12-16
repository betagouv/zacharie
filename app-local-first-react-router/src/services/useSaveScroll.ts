import { useEffect } from 'react';

export function useSaveScroll(propId: string) {
  useEffect(() => {
    const id = `${propId}-scrollY`;
    function handleScrollEnd() {
      window.sessionStorage.setItem(id, window.scrollY.toString());
    }
    const savedScrollY = window.sessionStorage.getItem(id);
    if (savedScrollY) {
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
