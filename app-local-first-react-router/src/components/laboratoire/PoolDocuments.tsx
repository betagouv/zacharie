import { useCallback, useRef, useState } from 'react';
import { Button } from '@codegouvfr/react-dsfr/Button';
import dayjs from 'dayjs';
import type { TrichineDocument } from '@prisma/client';
import { deposerDocumentPool, documentPoolPath } from '@app/services/laboratoire';
import { useDepotDocuments } from '@app/components/laboratoire/use-depot-documents';
import downloadApiFile from '@app/utils/download-api-file';
import { documentTypeLabels } from '@app/utils/trichine';

/** Dépôt du rapport d'analyse d'un pool : glisser-déposer ou sélection depuis l'ordinateur. */
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

  const deposerFichier = useCallback(
    (file: { content_type: string; content: string }) => deposerDocumentPool(poolId, file),
    [poolId]
  );
  const { deposer, isUploading } = useDepotDocuments(deposerFichier, onDone);

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
