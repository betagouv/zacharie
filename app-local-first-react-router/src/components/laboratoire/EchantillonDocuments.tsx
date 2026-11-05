import { useCallback, useRef } from 'react';
import { Button } from '@codegouvfr/react-dsfr/Button';
import dayjs from 'dayjs';
import type { TrichineDocument } from '@prisma/client';
import { deposerDocumentEchantillon, documentEchantillonPath } from '@app/services/laboratoire';
import { useDepotDocuments } from '@app/components/laboratoire/use-depot-documents';
import downloadApiFile from '@app/utils/download-api-file';
import { documentTypeLabels } from '@app/utils/trichine';

/**
 * Documents joints à un échantillon par le laboratoire (photo d'étiquette, échantillon abîmé…).
 * Sans `onDone`, l'échantillon est en lecture seule : ses documents restent téléchargeables.
 */
export default function EchantillonDocuments({
  echantillonId,
  referenceEchantillon,
  documents,
  onDone,
}: {
  echantillonId: string;
  referenceEchantillon: string;
  documents: Array<TrichineDocument>;
  onDone: (() => void) | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const deposerFichier = useCallback(
    (file: { content_type: string; content: string }) => deposerDocumentEchantillon(echantillonId, file),
    [echantillonId]
  );
  const { deposer, isUploading } = useDepotDocuments(deposerFichier, onDone ?? (() => {}));

  if (!onDone && documents.length === 0) return null;

  return (
    <div className="mt-2">
      {documents.length > 0 && (
        <ul className="fr-mb-1v list-none space-y-1 p-0">
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
                    path: documentEchantillonPath(echantillonId, document.id),
                    filename: `${referenceEchantillon}-${document.id}.${document.fichier_url.split('.').pop()}`,
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
      {onDone && (
        <>
          <Button
            type="button"
            size="small"
            priority="tertiary"
            iconId="fr-icon-attachment-line"
            disabled={isUploading}
            onClick={() => inputRef.current?.click()}
          >
            {isUploading ? 'Dépôt en cours…' : 'Joindre un fichier'}
          </Button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            className="hidden"
            aria-label={`Joindre un fichier à l'échantillon ${referenceEchantillon}`}
            onChange={(event) => {
              deposer(Array.from(event.target.files ?? []));
              // reset pour pouvoir redéposer le même fichier
              event.target.value = '';
            }}
          />
        </>
      )}
    </div>
  );
}
