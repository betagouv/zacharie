import { useMemo, useRef, useState } from 'react';
import {
  type Carcasse,
  CarcasseModificationRequestStatus,
  CarcasseModificationRequestType,
} from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import { createModal } from '@codegouvfr/react-dsfr/Modal';
import { useIsModalOpen } from '@codegouvfr/react-dsfr/Modal/useIsModalOpen';
import dayjs from 'dayjs';
import useZustandStore from '@app/zustand/store';
import useUser from '@app/zustand/user';
import {
  usePendingRequestForCarcasse,
  useHistoryForCarcasse,
} from '@app/utils/carcasse-modification-request';

// ----------------------------------------------------------------------------
// PendingModificationBanner
// Affiché sur la carcasse, côté intermédiaire/ETG/SVI, quand une demande de
// modification est en cours. Informe sans bloquer la transmission.
// ----------------------------------------------------------------------------
export function PendingModificationBanner({ carcasse }: { carcasse: Carcasse }) {
  const pending = usePendingRequestForCarcasse(carcasse.zacharie_carcasse_id);
  const requestedByUser = useZustandStore((state) =>
    pending ? state.users[pending.requested_by_user_id] : null
  );
  const requestedByEntity = useZustandStore((state) =>
    pending ? state.entities[pending.requested_by_entity_id] : null
  );

  if (!pending) return null;

  const title =
    pending.type === CarcasseModificationRequestType.BRACELET_RENAME
      ? `Demande de modification du numéro de bracelet en cours`
      : `Cette carcasse attend la signature de l'examinateur initial`;

  const detail =
    pending.type === CarcasseModificationRequestType.BRACELET_RENAME
      ? `Le numéro physique semble être « ${pending.numero_bracelet_after} » au lieu de « ${pending.numero_bracelet_before} ». L'examinateur initial doit approuver ou refuser ce changement.`
      : `Cette carcasse a été ajoutée par un intermédiaire. Elle n'est pas encore validée par l'examinateur initial et ne sera pas inspectée par le SVI tant que la signature n'est pas faite.`;

  const requester = [requestedByUser?.prenom, requestedByUser?.nom_de_famille].filter(Boolean).join(' ');
  const entityName = requestedByEntity?.nom_d_usage ?? '';
  const requesterLine =
    requester || entityName
      ? `Demande faite par ${requester || 'un intermédiaire'}${entityName ? ` (${entityName})` : ''} le ${dayjs(
          pending.requested_at
        ).format('DD/MM/YYYY HH:mm')}.`
      : '';

  return (
    <Alert
      severity="warning"
      title={title}
      description={
        <>
          <p className="mb-1">{detail}</p>
          {requesterLine && <p className="mb-0 text-sm opacity-80">{requesterLine}</p>}
          {pending.comment_intermediaire && (
            <p className="mt-1 mb-0 text-sm opacity-80">
              <span className="font-semibold">Commentaire :</span> {pending.comment_intermediaire}
            </p>
          )}
        </>
      }
      className="my-2"
    />
  );
}

// ----------------------------------------------------------------------------
// RequestBraceletRenameButton
// Bouton + modal côté intermédiaire pour signaler un numéro de bracelet
// incorrect. Désactivé si une demande est déjà en cours sur la carcasse.
// ----------------------------------------------------------------------------
export function RequestBraceletRenameButton({
  carcasse,
  requestedByEntityId,
  className,
}: {
  carcasse: Carcasse;
  requestedByEntityId: string;
  className?: string;
}) {
  const user = useUser((state) => state.user);
  const pending = usePendingRequestForCarcasse(carcasse.zacharie_carcasse_id);
  const createCarcasseModifRequest = useZustandStore((s) => s.createCarcasseModifRequest);
  const modal = useRef(
    createModal({
      isOpenedByDefault: false,
      id: `modif-rename-${carcasse.zacharie_carcasse_id}`,
    })
  ).current;
  const isOpen = useIsModalOpen(modal);

  const [newBracelet, setNewBracelet] = useState('');
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);

  const onSubmit = () => {
    setError(null);
    if (!user) {
      setError('Utilisateur non connecté.');
      return;
    }
    if (!newBracelet.trim()) {
      setError('Veuillez saisir le numéro de bracelet correct.');
      return;
    }
    if (newBracelet.trim() === carcasse.numero_bracelet) {
      setError("Le nouveau numéro est identique à l'actuel.");
      return;
    }
    createCarcasseModifRequest({
      id: uuidv4(),
      type: CarcasseModificationRequestType.BRACELET_RENAME,
      status: CarcasseModificationRequestStatus.PENDING,
      zacharie_carcasse_id: carcasse.zacharie_carcasse_id,
      fei_numero: carcasse.fei_numero,
      requested_by_user_id: user.id,
      requested_by_entity_id: requestedByEntityId,
      requested_at: dayjs().toDate(),
      comment_intermediaire: comment.trim() || null,
      numero_bracelet_before: carcasse.numero_bracelet,
      numero_bracelet_after: newBracelet.trim(),
      reviewed_by_user_id: null,
      reviewed_at: null,
      rejection_reason: null,
      created_at: dayjs().toDate(),
      updated_at: dayjs().toDate(),
      deleted_at: null,
      is_synced: false,
    });
    setNewBracelet('');
    setComment('');
    modal.close();
  };

  if (pending) {
    return null;
  }

  return (
    <>
      <Button
        priority="tertiary"
        size="small"
        onClick={() => modal.open()}
        className={className}
        type="button"
      >
        Signaler un numéro de bracelet incorrect
      </Button>
      <modal.Component title="Signaler un numéro de bracelet incorrect">
        {isOpen && (
          <div>
            <p className="mb-2 text-sm">
              Numéro saisi par l'examinateur initial : <span className="font-semibold">{carcasse.numero_bracelet}</span>
            </p>
            <Input
              label="Numéro de bracelet correct (lu sur la carcasse) *"
              nativeInputProps={{
                value: newBracelet,
                onChange: (e) => setNewBracelet(e.currentTarget.value),
                placeholder: 'Ex. ' + carcasse.numero_bracelet,
              }}
            />
            <Input
              label="Commentaire (optionnel)"
              textArea
              nativeTextAreaProps={{
                value: comment,
                onChange: (e) => setComment(e.currentTarget.value),
                rows: 3,
              }}
            />
            {error && <p className="text-action-high-red-marianne mt-1 text-sm">{error}</p>}
            <p className="mt-3 text-sm opacity-80">
              La demande sera envoyée à l'examinateur initial. La carcasse peut continuer son trajet en attendant. Le SVI
              ne pourra pas l'inspecter tant qu'elle est en attente.
            </p>
            <div className="mt-4 flex gap-2">
              <Button
                priority="primary"
                onClick={onSubmit}
                type="button"
              >
                Envoyer la demande
              </Button>
              <Button
                priority="secondary"
                onClick={() => modal.close()}
                type="button"
              >
                Annuler
              </Button>
            </div>
          </div>
        )}
      </modal.Component>
    </>
  );
}

// ----------------------------------------------------------------------------
// HistoriqueDesModifications
// Liste les demandes approuvées/refusées sur une carcasse.
// ----------------------------------------------------------------------------
export function HistoriqueDesModifications({ carcasse }: { carcasse: Carcasse }) {
  const history = useHistoryForCarcasse(carcasse.zacharie_carcasse_id);
  const users = useZustandStore((state) => state.users);
  const entities = useZustandStore((state) => state.entities);

  const items = useMemo(() => history, [history]);

  if (items.length === 0) return null;

  return (
    <details className="mt-4 border-t border-gray-200 pt-2">
      <summary className="cursor-pointer font-semibold">Historique des modifications ({items.length})</summary>
      <ul className="mt-2 space-y-2 text-sm">
        {items.map((r) => {
          const requester = users[r.requested_by_user_id];
          const reviewer = r.reviewed_by_user_id ? users[r.reviewed_by_user_id] : null;
          const entity = entities[r.requested_by_entity_id];
          const isRename = r.type === CarcasseModificationRequestType.BRACELET_RENAME;
          const approved = r.status === CarcasseModificationRequestStatus.APPROVED;
          return (
            <li
              key={r.id}
              className="border-l-2 pl-2"
              style={{ borderColor: approved ? '#18753c' : '#ce0500' }}
            >
              <p className="m-0">
                <span className="font-semibold">
                  {isRename ? 'Changement de numéro de bracelet' : 'Ajout d\'une carcasse manquante'}
                </span>
                {' · '}
                <span className={approved ? 'text-green-700' : 'text-red-700'}>
                  {approved ? 'Approuvée' : 'Refusée'}
                </span>
              </p>
              {isRename && (
                <p className="m-0 opacity-80">
                  {r.numero_bracelet_before} → {r.numero_bracelet_after}
                </p>
              )}
              <p className="m-0 opacity-70">
                Demandée par {[requester?.prenom, requester?.nom_de_famille].filter(Boolean).join(' ') || 'un intermédiaire'}
                {entity?.nom_d_usage ? ` (${entity.nom_d_usage})` : ''} le {dayjs(r.requested_at).format('DD/MM/YYYY HH:mm')}
              </p>
              {reviewer && r.reviewed_at && (
                <p className="m-0 opacity-70">
                  {approved ? 'Approuvée' : 'Refusée'} par {[reviewer.prenom, reviewer.nom_de_famille].filter(Boolean).join(' ')} le{' '}
                  {dayjs(r.reviewed_at).format('DD/MM/YYYY HH:mm')}
                </p>
              )}
              {r.comment_intermediaire && (
                <p className="m-0 opacity-70">Commentaire : {r.comment_intermediaire}</p>
              )}
              {r.rejection_reason && <p className="m-0 opacity-70">Motif du refus : {r.rejection_reason}</p>}
            </li>
          );
        })}
      </ul>
    </details>
  );
}
