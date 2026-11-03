import { useSearchParams } from 'react-router';

const STORAGE_KEY = 'zacharie_embedded';

// `?embedded=true` (iframe ou WebView d'une application tierce) masque la navigation de l'app.
// Le paramètre est gardé en sessionStorage pour survivre aux navigations internes (ex. nouvelle-fiche
// redirige vers la fiche créée). sessionStorage est propre à l'onglet / à l'iframe : un onglet
// normal n'est pas concerné.
export function useIsEmbedded() {
  const [searchParams] = useSearchParams();
  try {
    if (searchParams.get('embedded') === 'true') {
      window.sessionStorage.setItem(STORAGE_KEY, 'true');
      return true;
    }
    return window.sessionStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    // stockage indisponible (navigation privée stricte, iframe tierce bloquée) : on s'en tient à l'URL
    return searchParams.get('embedded') === 'true';
  }
}
