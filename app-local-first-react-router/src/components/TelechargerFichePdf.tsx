import { useState } from 'react';
import { Button } from '@codegouvfr/react-dsfr/Button';
import useZustandStore from '@app/zustand/store';
import downloadApiFile from '@app/utils/download-api-file';
import { matomoClickId } from '@app/services/matomo';

// Extrait PDF de la fiche (SVI et ETG), généré par le serveur : nécessite d'être en ligne.
export default function TelechargerFichePdf({ feiNumero }: { feiNumero: string }) {
  const isOnline = useZustandStore((state) => state.isOnline);
  const [isDownloading, setIsDownloading] = useState(false);

  return (
    <Button
      type="button"
      priority="secondary"
      iconId="fr-icon-download-line"
      disabled={!isOnline || isDownloading}
      nativeButtonProps={{
        ...matomoClickId('fiche-telecharger-pdf'),
        title: isOnline ? undefined : 'Disponible uniquement en ligne',
      }}
      onClick={async () => {
        setIsDownloading(true);
        try {
          await downloadApiFile({
            path: `fiche-pdf/${feiNumero}`,
            filename: `fiche-${feiNumero}.pdf`,
            accept: 'application/pdf',
            erreur: 'Impossible de télécharger la fiche',
          });
        } finally {
          setIsDownloading(false);
        }
      }}
    >
      {isDownloading ? 'Téléchargement…' : 'Télécharger la fiche en PDF'}
    </Button>
  );
}
