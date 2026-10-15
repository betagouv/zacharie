import { useRef, useState } from 'react';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';
import type { TrichineDocument } from '@prisma/client';
import fileToBase64 from '@app/utils/file-to-base64';
import {
  deposerPhotosLarveFTP,
  documentFtpPath,
  DOCUMENT_MAX_BYTES,
  PHOTO_CONTENT_TYPES,
} from '@app/services/laboratoire';
import downloadApiFile from '@app/utils/download-api-file';

/**
 * Photographies des larves observées par le LVD, jointes à la FTP de confirmation pour le LNR.
 * Le LVD les dépose, le LNR les consulte.
 */
export default function LarvePhotos({
  ftpId,
  numeroFiche,
  documents,
  peutDeposer,
  onDone,
}: {
  ftpId: string;
  numeroFiche: string;
  documents: Array<TrichineDocument>;
  peutDeposer: boolean;
  onDone: (documents: Array<TrichineDocument>) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const deposer = async (files: Array<File>) => {
    if (!files.length) return;
    setIsUploading(true);
    const deposes: Array<TrichineDocument> = [];
    try {
      // Un fichier par requête : plusieurs photos de 3,5 Mo dépasseraient la taille d'un appel
      for (const file of files) {
        if (!PHOTO_CONTENT_TYPES.includes(file.type)) {
          toast.error(`${file.name} : format non accepté (JPEG, PNG ou WebP)`);
          continue;
        }
        if (file.size > DOCUMENT_MAX_BYTES) {
          toast.error(`${file.name} : fichier trop volumineux (3,5 Mo maximum)`);
          continue;
        }
        const content = await fileToBase64(file);
        const response = await deposerPhotosLarveFTP(ftpId, [{ content_type: file.type, content }]);
        if (response.ok && response.data) {
          deposes.push(...response.data.documents);
        } else {
          toast.error(response.error || `${file.name} n'a pas pu être déposée`);
        }
      }
    } catch {
      toast.error('Une erreur est survenue lors du dépôt');
    } finally {
      setIsUploading(false);
    }
    if (deposes.length > 0) {
      toast.success(deposes.length > 1 ? `${deposes.length} photos déposées` : 'Photo déposée');
      onDone(deposes);
    }
  };

  return (
    <div>
      <h3 className="fr-text--sm fr-mb-1w font-bold">Photographies des larves</h3>
      {documents.length > 0 ? (
        <ul className="fr-text--sm fr-mb-1w list-none space-y-1 p-0">
          {documents.map((document, index) => (
            <li
              key={document.id}
              className="flex flex-wrap items-center gap-2 rounded border border-gray-200 p-2"
            >
              <span>
                Photo {index + 1} — déposée le {dayjs(document.date_ajout).format('DD/MM/YYYY')}
              </span>
              <button
                type="button"
                className="fr-link fr-text--sm fr-link--icon-left fr-icon-download-line"
                onClick={() =>
                  downloadApiFile({
                    path: documentFtpPath(ftpId, document.id),
                    filename: `${numeroFiche}-${document.id}.${document.fichier_url.split('.').pop()}`,
                    erreur: 'Impossible de télécharger la photo',
                  })
                }
              >
                Télécharger
              </button>
            </li>
          ))}
        </ul>
      ) : (
        !peutDeposer && <p className="fr-text--sm fr-mb-0 text-gray-600">Aucune photo déposée.</p>
      )}
      {peutDeposer && (
        <>
          <Button
            type="button"
            priority="secondary"
            size="small"
            iconId="fr-icon-camera-line"
            disabled={isUploading}
            onClick={() => inputRef.current?.click()}
          >
            {isUploading ? 'Dépôt en cours…' : 'Ajouter des photos'}
          </Button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.webp"
            className="hidden"
            onChange={(event) => {
              deposer(Array.from(event.target.files ?? []));
              // reset pour pouvoir redéposer le même fichier
              event.target.value = '';
            }}
          />
          <p className="fr-text--xs fr-mt-1w fr-mb-0 text-gray-600">JPEG, PNG ou WebP — 3,5 Mo maximum</p>
        </>
      )}
    </div>
  );
}
