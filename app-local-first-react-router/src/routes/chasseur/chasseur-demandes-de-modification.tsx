import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import dayjs from 'dayjs';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import useZustandStore from '@app/zustand/store';
import useUser from '@app/zustand/user';
import {
  fetchModifRequestsForExaminateur,
  CarcasseModificationRequestStatus,
  CarcasseModificationRequestType,
} from '@app/utils/carcasse-modification-request';

// Page dashboard listant les demandes en attente où l'utilisateur est l'examinateur initial.
// Le lien des notifications email/SMS/push pointe vers /app/chasseur/demandes-de-modification.
export default function ChasseurDemandesDeModification() {
  const user = useUser((state) => state.user);
  const requestsById = useZustandStore((state) => state.carcasseModifRequestsById);
  const carcasses = useZustandStore((state) => state.carcasses);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchModifRequestsForExaminateur().then((res) => {
      if (!active) return;
      setLoading(false);
      if (!res.ok) setError(res.error);
    });
    return () => {
      active = false;
    };
  }, []);

  const pendingForMe = useMemo(() => {
    if (!user) return [];
    return Object.values(requestsById)
      .filter((r) => r.status === CarcasseModificationRequestStatus.PENDING && !r.deleted_at)
      .filter((r) => {
        // Filter to those where the underlying carcasse is examined by this user.
        const carcasse = carcasses[r.zacharie_carcasse_id];
        return carcasse?.examinateur_initial_user_id === user.id;
      })
      .sort((a, b) => new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime());
  }, [requestsById, carcasses, user]);

  const groupedByFei = useMemo(() => {
    const groups: Record<string, typeof pendingForMe> = {};
    for (const r of pendingForMe) {
      groups[r.fei_numero] ??= [];
      groups[r.fei_numero].push(r);
    }
    return groups;
  }, [pendingForMe]);

  return (
    <div className="fr-container fr-py-4w">
      <h1>Demandes de modification</h1>
      <p className="opacity-80">
        Les intermédiaires peuvent vous demander de corriger un numéro de bracelet, ou de signer une carcasse qu'ils ont
        ajoutée à une fiche. Toute modification doit être approuvée par vous, l'examinateur initial.
      </p>
      {error && (
        <Alert
          severity="error"
          title="Erreur de chargement"
          description={error}
        />
      )}
      {loading && pendingForMe.length === 0 && <p>Chargement…</p>}
      {!loading && pendingForMe.length === 0 && (
        <Alert
          severity="info"
          title="Aucune demande en attente"
          description="Aucun intermédiaire ne vous demande de modification actuellement."
        />
      )}
      {Object.entries(groupedByFei).map(([feiNumero, requests]) => (
        <section
          key={feiNumero}
          className="fr-mt-4w"
        >
          <h2 className="fr-h4">Fiche {feiNumero}</h2>
          <ul className="space-y-2">
            {requests.map((r) => {
              const isRename = r.type === CarcasseModificationRequestType.BRACELET_RENAME;
              return (
                <li
                  key={r.id}
                  className="rounded-sm border border-orange-300 bg-orange-50 p-3"
                >
                  <p className="m-0 font-semibold">
                    {isRename ? 'Changement de numéro de bracelet' : 'Nouvelle carcasse à signer'}
                  </p>
                  {isRename && (
                    <p className="m-0 text-sm">
                      <span className="font-medium">{r.numero_bracelet_before}</span> →{' '}
                      <span className="font-medium">{r.numero_bracelet_after}</span>
                    </p>
                  )}
                  <p className="m-0 text-sm opacity-70">
                    Demandée le {dayjs(r.requested_at).format('DD/MM/YYYY HH:mm')}
                  </p>
                  {r.comment_intermediaire && (
                    <p className="m-0 text-sm opacity-80">
                      Commentaire : {r.comment_intermediaire}
                    </p>
                  )}
                  <div className="mt-2">
                    <Link
                      to={`/app/chasseur/demandes-de-modification/${r.id}`}
                      className="fr-btn fr-btn--secondary fr-btn--sm"
                    >
                      Voir et traiter
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
