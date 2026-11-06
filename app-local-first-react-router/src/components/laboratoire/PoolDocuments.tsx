import { useCallback, useRef } from 'react';
import { Button } from '@codegouvfr/react-dsfr/Button';
import dayjs from 'dayjs';
import type { TrichineDocument } from '@prisma/client';
import { deposerDocumentPool, documentPoolPath } from '@app/services/laboratoire';
import { useDepotDocuments } from '@app/components/laboratoire/use-depot-documents';
import downloadApiFile from '@app/utils/download-api-file';
import { documentTypeLabels } from '@app/utils/trichine';

/** Rapport d'analyse d'un pool : liste des fichiers déposés et bouton pour en joindre un. */
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

  const deposerFichier = useCallback(
    (file: { content_type: string; content: string }) => deposerDocumentPool(poolId, file),
    [poolId]
  );
  const { deposer, isUploading } = useDepotDocuments(deposerFichier, onDone);

  return (
    <div className="fr-mt-2w">
      {documents.length > 0 && (
        <ul className="fr-text--sm fr-mb-1v list-none space-y-1 p-0">
          {documents.map((document) => (
            <li
              key={document.id}
              className="flex flex-wrap items-center gap-2"
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
      <Button
        type="button"
        size="small"
        priority="tertiary"
        iconId="fr-icon-attachment-line"
        disabled={isUploading}
        onClick={() => inputRef.current?.click()}
      >
        {isUploading
          ? 'Dépôt en cours…'
          : documents.length > 0
            ? 'Ajouter un autre fichier'
            : "Joindre le rapport d'analyse"}
      </Button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        className="hidden"
        aria-label={`Joindre le rapport d'analyse du pool ${referencePool}`}
        onChange={(event) => {
          deposer(Array.from(event.target.files ?? []));
          // reset pour pouvoir redéposer le même fichier
          event.target.value = '';
        }}
      />
    </div>
  );
}
