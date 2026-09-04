import { useEffect } from 'react';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { createModal } from '@codegouvfr/react-dsfr/Modal';
import { useIsModalOpen } from '@codegouvfr/react-dsfr/Modal/useIsModalOpen';
import useDownloadFtpPdf from '@app/utils/download-ftp-pdf';

const apercuModal = createModal({ id: 'trichine-ftp-apercu-pdf', isOpenedByDefault: false });

/** Aperçu du PDF de la fiche de transmission dans une modale, et téléchargement pour l'impression. */
export default function TrichineFTPPdfActions({
  space,
  ftpId,
  numeroFiche,
}: {
  space: 'trichine' | 'laboratoire';
  ftpId: string;
  numeroFiche: string;
}) {
  const { isDownloading, onDownloadFtpPdf, isPreviewLoading, previewUrl, onPreviewFtpPdf, closePreview } =
    useDownloadFtpPdf(space);
  const isApercuOpen = useIsModalOpen(apercuModal);

  // La modale se ferme aussi par la croix, Échap ou le fond : on libère l'aperçu dans tous les cas
  useEffect(() => {
    if (!isApercuOpen) closePreview();
  }, [isApercuOpen, closePreview]);

  return (
    <>
      <Button
        type="button"
        priority="secondary"
        iconId="fr-icon-eye-line"
        disabled={isPreviewLoading}
        onClick={() => {
          onPreviewFtpPdf(ftpId).then((ok) => {
            if (ok) apercuModal.open();
          });
        }}
      >
        {isPreviewLoading ? 'Chargement…' : 'Prévisualiser la fiche'}
      </Button>
      <Button
        type="button"
        priority="secondary"
        iconId="fr-icon-download-line"
        disabled={isDownloading}
        onClick={() => onDownloadFtpPdf(ftpId, numeroFiche)}
      >
        Télécharger la fiche
      </Button>
      <apercuModal.Component
        size="large"
        title={`Fiche de transmission ${numeroFiche}`}
        buttons={[
          {
            children: 'Fermer',
            priority: 'secondary',
            type: 'button',
          },
          {
            children: 'Télécharger',
            iconId: 'fr-icon-download-line',
            type: 'button',
            disabled: isDownloading,
            doClosesModal: false,
            onClick: () => onDownloadFtpPdf(ftpId, numeroFiche),
          },
        ]}
      >
        {!!previewUrl && (
          <iframe
            src={previewUrl}
            title={`Aperçu de la fiche ${numeroFiche}`}
            className="h-[70vh] min-h-96 w-full border-0"
          />
        )}
      </apercuModal.Component>
    </>
  );
}
