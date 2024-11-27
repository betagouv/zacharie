import { useIsOnline } from '@app/utils-offline/use-is-offline';

export default function OfflineMode() {
  const isOnline = useIsOnline();

  if (isOnline) {
    return null;
  }
  return (
    <p className="z-50 bg-action-high-blue-france px-4 py-2 text-sm text-white">
      Vous n'avez pas internet, ou votre connexion est très mauvaise. Les fiches que vous créez/modifiez
      actuellement seront synchronisées automatiquement lorsque vous aurez retrouvé une connexion.
    </p>
  );
}
