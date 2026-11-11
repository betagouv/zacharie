import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import API from '@app/services/api';
import Chargement from '@app/components/Chargement';
import type { AdminInboxResponse } from '@api/src/types/responses';

type Inbox = NonNullable<AdminInboxResponse['data']>;

type Categorie = {
  cle: string;
  icone: string;
  compte: number;
  titre: string;
  detail: string;
  to: string;
};

function CarteContenu({ categorie }: { categorie: Omit<Categorie, 'cle' | 'to'> }) {
  const vide = categorie.compte === 0;
  return (
    <>
      <span
        className={`${vide ? 'fr-icon-check-line' : categorie.icone} fr-icon--lg block ${
          vide ? 'text-gray-300' : 'text-[#000091]'
        }`}
        aria-hidden="true"
      />
      <span
        className={`mt-2 block text-3xl font-bold tabular-nums ${vide ? 'text-gray-300' : 'text-gray-900'}`}
      >
        {categorie.compte}
      </span>
      <span className="block font-semibold text-gray-900">{categorie.titre}</span>
      <span className="block text-xs text-gray-600">{categorie.detail}</span>
    </>
  );
}

export default function AdminATraiter() {
  const [loading, setLoading] = useState(true);
  const [inbox, setInbox] = useState<Inbox | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    API.get({ path: 'admin/inbox' })
      .then((res) => res as AdminInboxResponse)
      .then((res) => {
        if (res.ok) {
          setInbox(res.data);
        } else {
          setError(res.error || 'Erreur lors du chargement des éléments à traiter.');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <Chargement />;
  }

  if (!inbox) {
    return error ? (
      <Alert
        severity="error"
        small
        description={error}
        className="m-4"
      />
    ) : null;
  }

  const categories: Array<Categorie> = [
    {
      cle: 'en-attente-activation',
      icone: 'fr-icon-user-line',
      compte: inbox.en_attente_activation,
      titre: "En attente d'activation",
      detail: 'onboarding terminé, compte pas encore activé',
      to: '/app/admin/users?statut=deactivated&onboarding=completed',
    },
    {
      cle: 'cfei-introuvable',
      icone: 'fr-icon-error-warning-line',
      compte: inbox.cfei_introuvable,
      titre: 'CFEI introuvable',
      detail: 'numéro absent de la liste officielle',
      to: '/app/admin/users?cfei_validation=invalid',
    },
    {
      cle: 'onboarding-incomplet',
      icone: 'fr-icon-time-line',
      compte: inbox.onboarding_incomplet,
      titre: 'Onboarding incomplet > 7 j',
      detail: 'la liste montre aussi les comptes créés récemment',
      to: '/app/admin/users?onboarding=incomplete',
    },
    {
      cle: 'entites-non-pretes',
      icone: 'fr-icon-building-line',
      compte: inbox.entites_non_pretes,
      titre: 'Entités non prêtes',
      detail: 'pas encore compatibles Zacharie',
      to: '/app/admin/entities?compatible=false',
    },
  ];

  const comptesBloques = inbox.comptes_bloques;

  return (
    <div className="py-6">
      <title>
        À traiter | Admin | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire
      </title>
      <h2 className="fr-mb-3w text-xl font-bold">À traiter</h2>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((categorie) =>
          categorie.compte === 0 ? (
            <div
              key={categorie.cle}
              className="block h-full rounded-lg border border-gray-200 bg-white p-4 text-gray-400"
            >
              <CarteContenu categorie={categorie} />
            </div>
          ) : (
            <Link
              key={categorie.cle}
              to={categorie.to}
              className="block h-full rounded-lg border border-[#000091] bg-white bg-none p-4 transition hover:bg-blue-50"
            >
              <CarteContenu categorie={categorie} />
            </Link>
          )
        )}
        <div
          className={`block h-full rounded-lg border bg-white p-4 ${
            comptesBloques.length === 0 ? 'border-gray-200 text-gray-400' : 'border-[#000091]'
          }`}
        >
          <CarteContenu
            categorie={{
              icone: 'fr-icon-lock-line',
              compte: comptesBloques.length,
              titre: 'Comptes bloqués',
              detail: "trop d'échecs de connexion ces 15 dernières minutes",
            }}
          />
          {comptesBloques.length > 0 && (
            <ul className="fr-mt-2w m-0 list-none p-0 text-sm">
              {comptesBloques.map((compte) => (
                <li key={compte.id}>
                  <Link to={`/app/admin/user/${compte.id}`}>
                    {compte.nom_de_famille || compte.prenom
                      ? `${compte.nom_de_famille ?? ''} ${compte.prenom ?? ''}`.trim()
                      : compte.email}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
