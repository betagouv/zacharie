import { useCallback, useRef, useState } from 'react';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';
import type { TrichineDocument } from '@prisma/client';
import {
  deposerDocumentPool,
  documentPoolPath,
  DOCUMENT_CONTENT_TYPES,
  DOCUMENT_MAX_BYTES,
} from '@app/services/laboratoire';
import downloadApiFile from '@app/utils/download-api-file';
import { documentTypeLabels } from '@app/utils/trichine';

/**
 * Dépôt du rapport d'analyse d'un pool : glisser-déposer ou sélection depuis l'ordinateur.
 * Le fichier part en base64, le serveur calcule la clé de stockage.
 */

// Lit le fichier et renvoie son contenu encodé en base64 (sans le préfixe data:).
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function PoolDocuments({
  poolId,
  referencePool,
  documents,
  onDone,
}: {
  poolId: string;
  referencePool: string;
  documents: Array<TrichineDocument>;
  onDone: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const deposer = useCallback(
    async (files: Array<File>) => {
      if (!files.length) return;
      setIsUploading(true);
      let deposes = 0;
      try {
        for (const file of files) {
          if (!DOCUMENT_CONTENT_TYPES.includes(file.type)) {
            toast.error(`${file.name} : format non accepté (PDF, JPEG, PNG ou WebP)`);
            continue;
          }
          if (file.size > DOCUMENT_MAX_BYTES) {
            toast.error(`${file.name} : fichier trop volumineux (3,5 Mo maximum)`);
            continue;
          }
          const content = await fileToBase64(file);
          const response = await deposerDocumentPool(poolId, { content_type: file.type, content });
          if (response.ok) {
            deposes++;
          } else {
            toast.error(response.error || `${file.name} n'a pas pu être déposé`);
          }
        }
      } catch {
        toast.error('Une erreur est survenue lors du dépôt');
      } finally {
        setIsUploading(false);
      }
      if (deposes > 0) {
        toast.success(deposes > 1 ? `${deposes} documents déposés` : 'Document déposé');
        onDone();
      }
    },
    [poolId, onDone]
  );

  return (
    <div className="fr-mt-2w">
      <h3 className="fr-text--sm fr-mb-1w font-bold">Rapport d'analyse</h3>

      {documents.length > 0 && (
        <ul className="fr-text--sm fr-mb-1w list-none space-y-1 p-0">
          {documents.map((document) => (
            <li
              key={document.id}
              className="flex flex-wrap items-center gap-2 rounded border border-gray-200 p-2"
            >
              <span>
                {documentTypeLabels[document.type] ?? document.type} — déposé le{' '}
                {dayjs(document.date_ajout).format('DD/MM/YYYY')}
              </span>
              <button
                type="button"
                className="fr-link fr-text--sm fr-link--icon-left fr-icon-download-line"
                onClick={() =>
                  downloadApiFile({
                    path: documentPoolPath(poolId, document.id),
                    // le nom du fichier d'origine n'est pas conservé : on nomme d'après le pool
                    filename: `${referencePool}-${document.id}.${document.fichier_url.split('.').pop()}`,
                    erreur: 'Impossible de télécharger le document',
                  })
                }
              >
                Télécharger
              </button>
            </li>
          ))}
        </ul>
      )}

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          deposer(Array.from(event.dataTransfer.files));
        }}
        className={`flex flex-col items-center gap-2 rounded border-2 border-dashed p-4 text-center ${
          isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
        }`}
      >
        <p className="fr-text--sm fr-mb-0 text-gray-600">
          Glissez-déposez le rapport d'analyse ici, ou&nbsp;:
        </p>
        <Button
          type="button"
          priority="secondary"
          size="small"
          disabled={isUploading}
          onClick={() => inputRef.current?.click()}
        >
          {isUploading ? 'Dépôt en cours…' : 'Choisir un fichier'}
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          className="hidden"
          onChange={(event) => {
            deposer(Array.from(event.target.files ?? []));
            // reset pour pouvoir redéposer le même fichier
            event.target.value = '';
          }}
        />
        <p className="fr-text--xs fr-mb-0 text-gray-600">PDF, JPEG, PNG ou WebP — 3,5 Mo maximum</p>
      </div>
    </div>
  );
}
