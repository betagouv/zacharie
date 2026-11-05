import { useCallback, useState } from 'react';
import { toast } from 'react-toastify';
import { DOCUMENT_CONTENT_TYPES, DOCUMENT_MAX_BYTES } from '@app/services/laboratoire';
import fileToBase64 from '@app/utils/file-to-base64';

type DeposerFichier = (file: {
  content_type: string;
  content: string;
}) => Promise<{ ok: boolean; error: string }>;

/**
 * Dépôt d'un ou plusieurs fichiers (contrôle du format et de la taille, envoi en base64).
 * Le serveur calcule la clé de stockage.
 */
export function useDepotDocuments(deposerFichier: DeposerFichier, onDone: () => void) {
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
          const response = await deposerFichier({ content_type: file.type, content });
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
    [deposerFichier, onDone]
  );

  return { deposer, isUploading };
}
