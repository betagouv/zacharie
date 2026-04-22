import { useIsOnline } from '@app/utils-offline/use-is-offline';

export default function OfflineMode() {
  const isOnline = useIsOnline();

  if (isOnline) {
    return null;
  }
  return (
    <p className="bg-action-high-blue-france fixed right-0 bottom-16 left-0 z-50 px-4 py-2 text-sm text-white md:bottom-0">
      Vous n'avez pas internet, ou votre connexion est très mauvaise. Les fiches que vous créez/modifiez actuellement seront synchronisées
      automatiquement lorsque vous aurez retrouvé une connexion.
    </p>
  );
}
