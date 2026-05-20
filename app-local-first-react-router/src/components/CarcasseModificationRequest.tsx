import { useMemo, useState } from 'react';
import {
  type Carcasse,
  CarcasseModificationRequestStatus,
  CarcasseModificationRequestType,
} from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import dayjs from 'dayjs';
import useZustandStore, { syncData } from '@app/zustand/store';
import useUser from '@app/zustand/user';
import {
  usePendingRequestForCarcasse,
  useRequestsForCarcasse,
} from '@app/utils/carcasse-modification-request';

// ----------------------------------------------------------------------------
// PendingModificationBanner
// Affiché sur la carcasse, côté intermédiaire/ETG/SVI, quand une demande de
// modification est en cours. Informe sans bloquer la transmission.
// ----------------------------------------------------------------------------
export function PendingModificationBanner({ carcasse }: { carcasse: Carcasse }) {
  const user = useUser((state) => state.user);
  const pending = usePendingRequestForCarcasse(carcasse.zacharie_carcasse_id);
  const requestedByUser = useZustandStore((state) =>
    pending ? state.users[pending.requested_by_user_id] : null
  );
  const requestedByEntity = useZustandStore((state) =>
    pending ? state.entities[pending.requested_by_entity_id] : null
  );
  const updateCarcasseModifRequest = useZustandStore((s) => s.updateCarcasseModifRequest);
  const updateCarcasse = useZustandStore((s) => s.updateCarcasse);

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

  const isRequester = user?.id === pending.requested_by_user_id;

  const onCancel = () => {
    if (!window.confirm('Annuler cette demande ? Cette action est irréversible.')) return;
    // Soft-delete the modif request. For NEW_CARCASSE we also soft-delete the carcasse since it only
    // existed because of this request.
    updateCarcasseModifRequest(pending.id, { deleted_at: dayjs().toDate() });
    if (pending.type === CarcasseModificationRequestType.NEW_CARCASSE) {
      updateCarcasse(carcasse.zacharie_carcasse_id, { deleted_at: dayjs().toDate() }, true);
    }
  };

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
          {isRequester && (
            <div className="mt-2">
              <Button
                priority="tertiary"
                size="small"
                onClick={onCancel}
                type="button"
              >
                Annuler ma demande
              </Button>
            </div>
          )}
        </>
      }
      className="m-0!"
    />
  );
}

// ----------------------------------------------------------------------------
// RequestBraceletRenameButton
// Bouton + formulaire en accordéon côté intermédiaire pour signaler un numéro
// de bracelet incorrect. Pas de modal imbriquée : DSFR ne supporte pas modal
// dans modal (le contenu du parent disparaît à la fermeture du modal enfant) ;
// on étale donc le formulaire dans le même conteneur que le bouton.
// Désactivé si une demande est déjà en cours sur la carcasse.
// ----------------------------------------------------------------------------
export function RequestBraceletRenameButton({
  carcasse,
  requestedByEntityId,
  className,
  onSubmitted,
}: {
  carcasse: Carcasse;
  requestedByEntityId: string;
  className?: string;
  onSubmitted?: () => void;
}) {
  const user = useUser((state) => state.user);
  const pending = usePendingRequestForCarcasse(carcasse.zacharie_carcasse_id);
  const createCarcasseModifRequest = useZustandStore((s) => s.createCarcasseModifRequest);

  const [expanded, setExpanded] = useState(false);
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
    syncData('RequestBraceletRenameButton.onSubmit');
    setNewBracelet('');
    setComment('');
    setExpanded(false);
    onSubmitted?.();
  };

  if (pending) {
    return null;
  }

  return (
    <div className={className}>
      <Button
        priority="tertiary"
        size="small"
        onClick={() => setExpanded((v) => !v)}
        type="button"
      >
        {expanded ? 'Annuler le signalement' : 'Signaler un numéro de bracelet incorrect'}
      </Button>
      {expanded && (
        <div className="fr-mt-2w rounded-sm border border-gray-300 p-3">
          <p className="mb-2 text-sm">
            Numéro saisi par l'examinateur initial :{' '}
            <span className="font-semibold">{carcasse.numero_bracelet}</span>
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
            La demande sera envoyée à l'examinateur initial. La carcasse peut continuer son trajet en
            attendant. Le SVI ne pourra pas l'inspecter tant qu'elle est en attente.
          </p>
          <div className="mt-4 flex gap-2">
            <Button
              priority="primary"
              onClick={onSubmit}
              type="button"
            >
              Envoyer la demande
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// HistoriqueDesModifications
// Liste les demandes approuvées/refusées sur une carcasse.
// ----------------------------------------------------------------------------
export function HistoriqueDesModifications({ carcasse }: { carcasse: Carcasse }) {
  const requests = useRequestsForCarcasse(carcasse.zacharie_carcasse_id);
  const users = useZustandStore((state) => state.users);
  const entities = useZustandStore((state) => state.entities);

  // Flatten each modif into two timeline events: one for the request, one for the decision. This
  // keeps each timestamp on its own dot (request date != decision date). Sorted oldest → newest like
  // Traçabilité.
  type TimelineEvent = {
    key: string;
    date: Date;
    label: string;
    actorLine: string;
    extraLine: string | null;
    dotColor: string; // hex
  };

  const events = useMemo<Array<TimelineEvent>>(() => {
    const out: Array<TimelineEvent> = [];
    for (const r of requests) {
      const requester = users[r.requested_by_user_id];
      const reviewer = r.reviewed_by_user_id ? users[r.reviewed_by_user_id] : null;
      const entity = entities[r.requested_by_entity_id];
      const isRename = r.type === CarcasseModificationRequestType.BRACELET_RENAME;
      const approved = r.status === CarcasseModificationRequestStatus.APPROVED;
      const rejected = r.status === CarcasseModificationRequestStatus.REJECTED;
      const pending = r.status === CarcasseModificationRequestStatus.PENDING;
      const entityName = entity?.nom_d_usage ?? '';
      const requesterName =
        [requester?.prenom, requester?.nom_de_famille].filter(Boolean).join(' ') || 'un intermédiaire';
      const reviewerName = reviewer
        ? [reviewer.prenom, reviewer.nom_de_famille].filter(Boolean).join(' ')
        : null;

      // 1) Request event (always)
      out.push({
        key: `${r.id}:req`,
        date: new Date(r.requested_at),
        label: isRename
          ? `Demande de changement de bracelet : ${r.numero_bracelet_before} → ${r.numero_bracelet_after}`
          : "Demande d'ajout d'une carcasse",
        actorLine: `Demandée par ${requesterName}${entityName ? ` (${entityName})` : ''}`,
        extraLine: r.comment_intermediaire ? `Commentaire : ${r.comment_intermediaire}` : null,
        dotColor: '#6a6af4', // DSFR blue
      });

      // 2) Decision event — pending shows a placeholder; approved/rejected shows the result.
      if (pending) {
        out.push({
          key: `${r.id}:pending`,
          date: new Date(r.updated_at), // approximate; placed near the request marker by sort
          label: "En attente de décision de l'examinateur initial",
          actorLine: 'Aucune décision pour le moment',
          extraLine: null,
          dotColor: '#b34000', // DSFR warning orange — same severity hue as the pending banner
        });
      } else if (r.reviewed_at) {
        out.push({
          key: `${r.id}:dec`,
          date: new Date(r.reviewed_at),
          label: approved
            ? isRename
              ? `Numéro de bracelet modifié : ${r.numero_bracelet_before} → ${r.numero_bracelet_after}`
              : "Ajout d'une carcasse validé"
            : isRename
              ? `Refus du changement de numéro : ${r.numero_bracelet_before} → ${r.numero_bracelet_after}`
              : "Refus d'ajout d'une carcasse",
          actorLine: reviewerName
            ? `${approved ? 'Approuvée' : 'Refusée'} par ${reviewerName}`
            : approved
              ? 'Approuvée'
              : 'Refusée',
          extraLine: rejected && r.rejection_reason ? `Motif du refus : ${r.rejection_reason}` : null,
          dotColor: approved ? '#18753c' : '#ce0500',
        });
      }
    }
    out.sort((a, b) => a.date.getTime() - b.date.getTime());
    return out;
  }, [requests, users, entities]);

  if (events.length === 0) return null;

  // Renders content only (no collapsible/heading wrapper). Parents wrap in a Section / modal block /
  // <details> as appropriate to their layout.
  return (
    <div className="relative border-l-2 border-gray-300 pl-4">
      {events.map((event) => (
        <div
          key={event.key}
          className="relative mb-4 last:mb-0"
        >
          <div
            className="absolute top-1 -left-[21px] h-2.5 w-2.5 rounded-full border-2 bg-white"
            style={{ borderColor: event.dotColor }}
          />
          <div className="text-sm">
            <span className="text-gray-500">{dayjs(event.date).format('dddd D MMMM YYYY [à] HH:mm')}</span>{' '}
            <span className="font-semibold">{event.label}</span>
          </div>
          <div className="text-sm opacity-70">{event.actorLine}</div>
          {event.extraLine && <div className="text-sm opacity-70">{event.extraLine}</div>}
        </div>
      ))}
    </div>
  );
}
