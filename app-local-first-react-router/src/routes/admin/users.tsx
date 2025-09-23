import { Fragment, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Table } from '@codegouvfr/react-dsfr/Table';
import dayjs from 'dayjs';
import type { AdminUsersResponse } from '@api/src/types/responses';
import Chargement from '@app/components/Chargement';
import { Tabs, type TabsProps } from '@codegouvfr/react-dsfr/Tabs';
import API from '@app/services/api';

export default function AdminUsers() {
  const [users, setUsers] = useState<NonNullable<AdminUsersResponse['data']['users']>>([]);
  const navigate = useNavigate();
  const tabs: TabsProps['tabs'] = [
    {
      tabId: 'all',
      label: `Tous (${users.length})`,
    },
    {
      tabId: 'activated',
      label: `Activés (${users.filter((user) => user.activated).length})`,
    },
    {
      tabId: 'deactivated',
      label: `Désactivés (${users.filter((user) => !user.activated).length})`,
    },
  ];
  const [selectedTabId, setSelectedTabId] = useState(tabs[0].tabId);

  useEffect(() => {
    API.get({ path: 'admin/users' })
      .then((res) => res as AdminUsersResponse)
      .then((res) => {
        if (res.ok) {
          setUsers(res.data.users);
        }
      });
  }, []);

  if (!users?.length) {
    return <Chargement />;
  }

  return (
    <div className="fr-container--fluid fr-my-md-14v">
      <title>
        Utilisateurs | Admin | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire
      </title>
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
          <h1 className="fr-h2 fr-mb-2w">Utilisateurs</h1>
          <section className="mb-6 bg-white md:shadow-sm">
            <Tabs
              selectedTabId={selectedTabId}
              tabs={tabs}
              onTabChange={setSelectedTabId}
              className="[&_.fr-tabs\_\_list]:bg-alt-blue-france! mb-6 bg-white md:shadow-sm [&_.fr-tabs\_\_list]:shadow-none!"
            >
              <div className="p-4 md:p-8 md:pb-0 [&_a]:block [&_a]:p-4 [&_a]:no-underline has-[a]:[&_td]:p-0!">
                <Table
                  fixed
                  noCaption
                  className="[&_td]:h-px"
                  headers={['Dates', 'Identité', 'Roles', 'Actions']}
                  data={users
                    .filter((user) => {
                      if (selectedTabId === 'activated') {
                        return user.activated;
                      }
                      if (selectedTabId === 'deactivated') {
                        return !user.activated;
                      }
                      return true;
                    })
                    .map((user, index) => [
                      <div
                        key={user.id}
                        className="flex size-full flex-row items-start border-r border-r-gray-200"
                      >
                        <span className="p-4">{index + 1}</span>
                        <Link
                          to={`/app/tableau-de-bord/admin/user/${user.id}`}
                          className="inline-flex! size-full flex-col items-start justify-start bg-none! no-underline!"
                          suppressHydrationWarning
                        >
                          Compte activé: {user.activated ? '✅' : '❌'}
                          <br />
                          Créé le&nbsp;:
                          <br />
                          <span className="ml-8 text-sm text-gray-500">
                            {dayjs(user.created_at).format('DD/MM/YYYY à HH:mm')}
                          </span>
                          {user.activated_at ? (
                            <>
                              {user.activated ? 'Activé' : 'Désactivé'} le&nbsp;:
                              <span className="ml-8 text-sm text-gray-500">
                                {dayjs(user.activated_at).format('DD/MM/YYYY à HH:mm')}`
                              </span>
                            </>
                          ) : (
                            'Activé avant mai 2025'
                          )}
                        </Link>
                      </div>,
                      <Link
                        key={user.id}
                        to={`/app/tableau-de-bord/admin/user/${user.id}`}
                        className="no-scrollbar inline-flex! size-full items-start justify-start overflow-x-auto! border-r border-r-gray-200 bg-none! no-underline!"
                      >
                        {user.prenom} {user.nom_de_famille}
                        <br />
                        ＠&nbsp;{user.email}
                        <br />
                        ☎️ {user.telephone}
                        <br />
                        🏡 {user.addresse_ligne_1}
                        <br />
                        {user.addresse_ligne_2 && (
                          <>
                            <br />
                            {user.addresse_ligne_2}
                          </>
                        )}
                        {user.code_postal} {user.ville}
                      </Link>,
                      <Link
                        key={user.id}
                        to={`/app/tableau-de-bord/admin/user/${user.id}`}
                        className="no-scrollbar inline-flex! size-full items-center justify-start overflow-x-auto! border-r border-r-gray-200 bg-none! no-underline!"
                      >
                        {user.roles.map((role) => (
                          <Fragment key={role}>
                            {role}
                            <br />
                          </Fragment>
                        ))}
                      </Link>,
                      <form
                        key={user.email}
                        method="POST"
                        className="no-scrollbar inline-flex! size-full items-center justify-start overflow-x-auto! border-r border-r-gray-200"
                        onSubmit={(event) => {
                          event.preventDefault();

                          API.post({
                            path: 'admin/user/connect-as',
                            body: {
                              email: user.email!,
                            },
                          })
                            .then(() => {
                              window.localStorage.clear();
                            })
                            .then(() => {
                              navigate('/app/tableau-de-bord');
                            });
                        }}
                      >
                        <button
                          type="submit"
                          className="text-action-high-blue-france h-full w-full text-center"
                        >
                          Se connecter en tant que
                          <br />
                          {user.email}
                        </button>
                        ,
                      </form>,
                    ])}
                />
              </div>
              <div className="flex flex-col items-start bg-white px-8 md:[&_ul]:min-w-96">
                <a className="fr-link fr-icon-arrow-up-fill fr-link--icon-left mb-4" href="#top">
                  Haut de page
                </a>
              </div>
            </Tabs>
          </section>
        </div>
      </div>
    </div>
  );
}
