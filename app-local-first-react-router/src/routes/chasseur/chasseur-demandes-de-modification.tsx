import { useMemo } from 'react';
import { Link } from 'react-router';
import dayjs from 'dayjs';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import useZustandStore from '@app/zustand/store';
import useUser from '@app/zustand/user';
import { CarcasseModificationRequestStatus, CarcasseModificationRequestType } from '@prisma/client';

// Page dashboard listant les demandes en attente où l'utilisateur est l'examinateur initial.
// Le lien des notifications email/SMS/push pointe vers /app/chasseur/demandes-de-modification.
export default function ChasseurDemandesDeModification() {
  const user = useUser((state) => state.user);
  const modifRequestsByCarcasseId = useZustandStore((state) => state.modifRequestsByCarcasseId);
  const carcasses = useZustandStore((state) => state.carcasses);
  const feis = useZustandStore((state) => state.feis);

  const pendingForMe = useMemo(() => {
    if (!user) return [];
    return Object.values(modifRequestsByCarcasseId)
      .flat()
      .filter((r) => r.status === CarcasseModificationRequestStatus.PENDING && !r.deleted_at)
      .filter((r) => {
        // Filter to those where the underlying carcasse is examined by this user.
        const carcasse = carcasses[r.zacharie_carcasse_id];
        return carcasse?.examinateur_initial_user_id === user.id;
      })
      .sort((a, b) => new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime());
  }, [modifRequestsByCarcasseId, carcasses, user]);

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
      <title>
        Demandes de modification | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire
      </title>
      <h1>Demandes de modification</h1>
      <p className="opacity-80">
        Une correction de numéro de marquage ou une validation de mise sur le marché vous est demandée. En
        tant qu'examinateur initial, approuvez ou refusez la demande.
      </p>
      {pendingForMe.length === 0 && (
        <Alert
          severity="info"
          title="Aucune demande en attente"
          description="Aucun intermédiaire ne vous demande de modification actuellement."
        />
      )}
      {Object.entries(groupedByFei).map(([feiNumero, requests]) => {
        const fei = feis[feiNumero];
        const datePart = fei?.date_mise_a_mort ? dayjs(fei.date_mise_a_mort).format('DD/MM') : null;
        const commune = fei?.commune_mise_a_mort?.trim();
        const heading = datePart
          ? `Fiche du ${datePart}${commune ? ` - ${commune}` : ''}`
          : `Fiche ${feiNumero}`;
        return (
          <section
            key={feiNumero}
            className="fr-mt-4w"
          >
            <h2 className="fr-h4">{heading}</h2>
            <ul className="space-y-2">
              {requests.map((r) => {
                const isRename = r.type === CarcasseModificationRequestType.BRACELET_RENAME;
                return (
                  <li
                    key={r.id}
                    className="rounded-sm border border-orange-300 bg-orange-50 p-3"
                  >
                    <p className="m-0 font-semibold">
                      {isRename ? 'Changement de numéro de marquage' : 'Nouvelle carcasse à signer'}
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
                      <p className="m-0 text-sm opacity-80">Commentaire : {r.comment_intermediaire}</p>
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
        );
      })}
    </div>
  );
}
