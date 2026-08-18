import { useMemo, useState } from 'react';
import {
  Carcasse,
  CarcasseModificationRequest,
  CarcasseModificationRequestStatus,
  CarcasseModificationRequestType,
} from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import dayjs from 'dayjs';
import useZustandStore from '@app/zustand/store';
import { syncData } from '@app/utils/sync-data';
import useUser from '@app/zustand/user';
import { getPendingModifRequest } from '@app/utils/modif-requests';

// Une carcasse déjà inspectée par le SVI n'est plus modifiable par une demande : un certificat a pu
// être émis dessus. Même règle que côté serveur (isCarcasseFrozenBySvi).
function isFrozenBySvi(carcasse: Carcasse) {
  return !!(
    carcasse.svi_ipm1_signed_at ||
    carcasse.svi_ipm2_signed_at ||
    carcasse.svi_closed_at ||
    carcasse.svi_automatic_closed_at
  );
}

// ----------------------------------------------------------------------------
// PendingModificationBanner
// Affiché sur la carcasse, côté intermédiaire/ETG/SVI, quand une demande de
// modification est en cours. Purement informatif : la modification est déjà
// appliquée, elle ne bloque ni la transmission ni l'inspection SVI.
// ----------------------------------------------------------------------------
export function PendingModificationBanner({ carcasse }: { carcasse: Carcasse }) {
  const user = useUser((state) => state.user);
  const modifRequests = useZustandStore(
    (state) => state.modifRequestsByCarcasseId[carcasse.zacharie_carcasse_id]
  );
  const pending = getPendingModifRequest(modifRequests);
  const requestedByUser = useZustandStore((state) =>
    pending ? state.users[pending.requested_by_user_id] : null
  );
  const requestedByEntity = useZustandStore((state) =>
    pending ? state.entities[pending.requested_by_entity_id] : null
  );
  const updateCarcasseModifRequest = useZustandStore((s) => s.updateCarcasseModifRequest);
  const updateCarcasse = useZustandStore((s) => s.updateCarcasse);

  if (!pending) return null;

  const isRename = pending.type === CarcasseModificationRequestType.BRACELET_RENAME;

  // La demande est purement indicative : elle ne bloque ni la transmission ni l'inspection SVI.
  // Sévérité info dans les deux cas — rien n'est en attente de déblocage.
  const title = isRename ? `Numéro de marquage corrigé` : `Carcasse ajoutée après l'examen initial`;

  const detail = isRename
    ? `Le numéro relevé sur la carcasse est « ${pending.numero_bracelet_after} », au lieu de « ${pending.numero_bracelet_before} » saisi à l'examen initial. La correction est déjà appliquée ; l'examinateur initial en a été informé.`
    : `Cette carcasse a été ajoutée par un intermédiaire. Elle suit son parcours normalement ; l'examinateur initial doit encore signer son examen initial.`;

  const requester = [requestedByUser?.prenom, requestedByUser?.nom_de_famille].filter(Boolean).join(' ');
  const entityName = requestedByEntity?.nom_d_usage ?? '';
  const requesterLine =
    requester || entityName
      ? `Demande faite par ${requester || 'un intermédiaire'}${entityName ? ` (${entityName})` : ''} le ${dayjs(
          pending.requested_at
        ).format('DD/MM/YYYY HH:mm')}.`
      : '';

  // On ne peut annuler que tant que le SVI n'est pas passé sur la carcasse (mêmes gardes qu'au
  // serveur), sinon l'annulation supprimerait une carcasse déjà inspectée / certifiée.
  const canCancel = user?.id === pending.requested_by_user_id && !isFrozenBySvi(carcasse);

  const onCancel = () => {
    // Soft-delete the modif request et on défait ce qu'elle avait appliqué : NEW_CARCASSE →
    // soft-delete de la carcasse (elle n'existait que pour cette demande), RENAME → retour au
    // numéro de marquage d'origine.
    updateCarcasseModifRequest(pending.zacharie_carcasse_id, { deleted_at: dayjs().toDate() });
    if (pending.type === CarcasseModificationRequestType.NEW_CARCASSE) {
      updateCarcasse(carcasse.zacharie_carcasse_id, { deleted_at: dayjs().toDate() });
    } else if (pending.numero_bracelet_before) {
      updateCarcasse(carcasse.zacharie_carcasse_id, { numero_bracelet: pending.numero_bracelet_before });
    }
    syncData('PendingModificationBanner.onCancel');
  };

  return (
    <Alert
      severity="info"
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
          {canCancel && (
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
// Bouton + formulaire en accordéon côté intermédiaire pour corriger un numéro
// de marquage. La correction est appliquée immédiatement (l'intermédiaire a la
// carcasse sous les yeux) ; l'examinateur initial en est seulement informé.
// Pas de modal imbriquée : DSFR ne supporte pas modal dans modal (le contenu du
// parent disparaît à la fermeture du modal enfant) ; on étale donc le
// formulaire dans le même conteneur que le bouton.
// Masqué si une demande est déjà en cours sur la carcasse.
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
  const modifRequests = useZustandStore((s) => s.modifRequestsByCarcasseId[carcasse.zacharie_carcasse_id]);
  const pending = getPendingModifRequest(modifRequests);
  const createCarcasseModifRequest = useZustandStore((s) => s.createCarcasseModifRequest);
  const updateCarcasse = useZustandStore((s) => s.updateCarcasse);

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
      setError('Veuillez saisir le numéro de marquage correct.');
      return;
    }
    if (newBracelet.trim() === carcasse.numero_bracelet) {
      setError("Le nouveau numéro est identique à l'actuel.");
      return;
    }
    const modifRequest: CarcasseModificationRequest = {
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
    };
    createCarcasseModifRequest(modifRequest);
    // Le renommage est appliqué tout de suite, la demande ne sert qu'à informer l'examinateur.
    updateCarcasse(carcasse.zacharie_carcasse_id, { numero_bracelet: newBracelet.trim() });
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
        {expanded ? 'Annuler la correction' : 'Corriger le numéro de marquage'}
      </Button>
      {expanded && (
        <div className="fr-mt-2w rounded-sm border border-gray-300 p-3">
          <p className="mb-2 text-sm">
            Numéro saisi par l'examinateur initial :{' '}
            <span className="font-semibold">{carcasse.numero_bracelet}</span>
          </p>
          <Input
            label="Numéro de marquage correct (lu sur la carcasse) *"
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
            La correction est appliquée immédiatement. L'examinateur initial en est informé et peut la
            contester, mais la carcasse continue son parcours normalement.
          </p>
          <div className="mt-4 flex gap-2">
            <Button
              priority="primary"
              onClick={onSubmit}
              type="button"
            >
              Corriger le numéro
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
  const requests = useZustandStore((state) => state.modifRequestsByCarcasseId[carcasse.zacharie_carcasse_id]);
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
    for (const r of requests ?? []) {
      if (r.deleted_at) continue;
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
          ? `Numéro de marquage corrigé : ${r.numero_bracelet_before} → ${r.numero_bracelet_after}`
          : "Ajout d'une carcasse",
        actorLine: `Par ${requesterName}${entityName ? ` (${entityName})` : ''}`,
        extraLine: r.comment_intermediaire ? `Commentaire : ${r.comment_intermediaire}` : null,
        dotColor: '#6a6af4', // DSFR blue
      });

      // 2) Decision event — pending shows a placeholder; approved/rejected shows the result.
      if (pending) {
        out.push({
          key: `${r.id}:pending`,
          date: new Date(r.updated_at), // approximate; placed near the request marker by sort
          label: "En attente du retour de l'examinateur initial",
          actorLine: 'La carcasse continue son parcours',
          extraLine: null,
          dotColor: '#0063cb', // DSFR info blue — même sévérité que la bannière, la demande est indicative
        });
      } else if (r.reviewed_at) {
        out.push({
          key: `${r.id}:dec`,
          date: new Date(r.reviewed_at),
          label: approved
            ? isRename
              ? `Numéro de marquage confirmé : ${r.numero_bracelet_after}`
              : "Ajout d'une carcasse validé"
            : isRename
              ? `Numéro de marquage contesté : l'examinateur initial lit ${r.numero_bracelet_before}`
              : "Refus d'ajout d'une carcasse",
          actorLine: (() => {
            const verbe = approved
              ? isRename
                ? 'Confirmée'
                : 'Validée'
              : isRename
                ? 'Contestée'
                : 'Refusée';
            return reviewerName ? `${verbe} par ${reviewerName}` : verbe;
          })(),
          extraLine: rejected && r.rejection_reason ? `Motif : ${r.rejection_reason}` : null,
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
