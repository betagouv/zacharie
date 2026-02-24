import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { createNewFei } from '@app/utils/create-new-fei';
import { useMostFreshUser } from '@app/utils-offline/get-most-fresh-user';
import { UserRoles } from '@prisma/client';

const SCROLL_THRESHOLD = 200;

export default function FloatingNewFicheButton() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useMostFreshUser('FloatingNewFicheButton');
  const [hasScrolled, setHasScrolled] = useState(false);

  const isFichesPage = location.pathname === '/app/tableau-de-bord';
  const shouldAnimate = isFichesPage;

  useEffect(() => {
    if (!shouldAnimate) {
      setHasScrolled(false);
      return;
    }
    function onScroll() {
      setHasScrolled(window.scrollY > SCROLL_THRESHOLD);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [shouldAnimate]);

  const isExaminateurInitial = user?.roles.includes(UserRoles.CHASSEUR) && !!user.numero_cfei;
  if (!isExaminateurInitial || !user?.activated) return null;

  const visible = shouldAnimate ? hasScrolled : true;

  return (
    <button
      type="button"
      className={`fr-btn fr-btn--icon-left ri-add-circle-line fixed right-6 bottom-6 z-50 hidden shadow-lg md:flex ${
        shouldAnimate
          ? `transition-all duration-300 ease-in-out ${visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'}`
          : ''
      }`}
      onClick={async () => {
        const newFei = await createNewFei();
        navigate(`/app/tableau-de-bord/fei/${newFei.numero}`);
      }}
    >
      Nouvelle fiche
    </button>
  );
}
