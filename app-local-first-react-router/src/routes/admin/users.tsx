import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Table } from '@codegouvfr/react-dsfr/Table';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { Select } from '@codegouvfr/react-dsfr/Select';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { UserRoles } from '@prisma/client';
import dayjs from 'dayjs';
import type { AdminUsersResponse } from '@api/src/types/responses';
import Chargement from '@app/components/Chargement';
import { Tabs, type TabsProps } from '@codegouvfr/react-dsfr/Tabs';
import API from '@app/services/api';
import { clearCache } from '@app/services/indexed-db';
import { refreshUser } from '@app/utils-offline/get-most-fresh-user';

export default function AdminUsers() {
  const [users, setUsers] = useState<NonNullable<AdminUsersResponse['data']['users']>>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [selectedCfeiStatus, setSelectedCfeiStatus] = useState<string>('');
  const [selectedOnboardingStatus, setSelectedOnboardingStatus] = useState<string>('');

  // Extract unique roles from all users
  const uniqueRoles = useMemo(() => {
    const rolesSet = new Set<UserRoles>();
    users.forEach((user) => {
      user.roles?.forEach((role) => rolesSet.add(role));
    });
    return Array.from(rolesSet).sort();
  }, [users]);

  const filteredUsers = users.filter((user) => {
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const searchableText = [
        user.prenom,
        user.nom_de_famille,
        user.email,
        user.telephone,
        user.addresse_ligne_1,
        user.addresse_ligne_2,
        user.code_postal,
        user.ville,
        user.numero_cfei,
        ...user.roles,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!searchableText.includes(query)) {
        return false;
      }
    }

    // Role filter
    if (selectedRole) {
      if (!user.roles?.includes(selectedRole as UserRoles)) {
        return false;
      }
    }

    // CFEI status filter
    if (selectedCfeiStatus) {
      if (selectedCfeiStatus === 'with_cfei' && !user.numero_cfei) {
        return false;
      }
      if (selectedCfeiStatus === 'without_cfei' && user.numero_cfei) {
        return false;
      }
      if (selectedCfeiStatus === 'trained' && !user.est_forme_a_l_examen_initial) {
        return false;
      }
    }

    // Onboarding status filter
    if (selectedOnboardingStatus) {
      if (selectedOnboardingStatus === 'completed' && !user.onboarded_at) {
        return false;
      }
      if (selectedOnboardingStatus === 'incomplete' && user.onboarded_at) {
        return false;
      }
    }

    return true;
  });

  const chasseursToActivate = filteredUsers.filter(
    (user) => !user.activated && user.roles?.includes(UserRoles.CHASSEUR),
  );

  const tabs: TabsProps['tabs'] = [
    {
      tabId: 'all',
      label: `Tous (${filteredUsers.length})`,
    },
    {
      tabId: 'chasseurs-a-activer',
      label: `Chasseurs à activer (${chasseursToActivate.length})`,
    },
    {
      tabId: 'activated',
      label: `Activés (${filteredUsers.filter((user) => user.activated).length})`,
    },
    {
      tabId: 'deactivated',
      label: `Désactivés (${filteredUsers.filter((user) => !user.activated).length})`,
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
          <div className="fr-mb-2w flex items-center justify-between gap-4">
            <h1 className="fr-h2">Utilisateurs</h1>
            <Button
              linkProps={{
                to: '/app/tableau-de-bord/admin/add-user',
              }}
            >
              + Ajouter des utilisateurs
            </Button>
          </div>
          <section className="mb-6 bg-white md:shadow-sm">
            <div className="space-y-4 p-4 md:p-8 md:pb-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Input
                  label="Rechercher un utilisateur"
                  nativeInputProps={{
                    type: 'search',
                    value: searchQuery,
                    onChange: (e) => setSearchQuery(e.target.value),
                    placeholder: 'Nom, email, téléphone, CFEI...',
                  }}
                />
                <Select
                  label="Filtrer par rôle"
                  nativeSelectProps={{
                    value: selectedRole,
                    onChange: (e) => setSelectedRole(e.target.value),
                  }}
                >
                  <option value="">Tous les rôles</option>
                  {uniqueRoles.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </Select>
                <Select
                  label="Statut CFEI"
                  nativeSelectProps={{
                    value: selectedCfeiStatus,
                    onChange: (e) => setSelectedCfeiStatus(e.target.value),
                  }}
                >
                  <option value="">Tous</option>
                  <option value="with_cfei">Avec numéro CFEI</option>
                  <option value="without_cfei">Sans numéro CFEI</option>
                  <option value="trained">Formé à l'examen initial</option>
                </Select>
                <Select
                  label="Statut onboarding"
                  nativeSelectProps={{
                    value: selectedOnboardingStatus,
                    onChange: (e) => setSelectedOnboardingStatus(e.target.value),
                  }}
                >
                  <option value="">Tous</option>
                  <option value="completed">Onboarding terminé</option>
                  <option value="incomplete">Onboarding incomplet</option>
                </Select>
              </div>
            </div>
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
                  className="[&_td]:align-top"
                  headers={
                    selectedTabId === 'chasseurs-a-activer'
                      ? ['Dates', 'Identité', 'CFEI / Formation', 'Actions']
                      : ['Dates', 'Identité', 'Roles', 'Actions']
                  }
                  data={filteredUsers
                    .filter((user) => {
                      if (selectedTabId === 'chasseurs-a-activer') {
                        return !user.activated && user.roles?.includes(UserRoles.CHASSEUR);
                      }
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
                          ) : user.activated ? (
                            'Activé avant août 2025'
                          ) : (
                            ''
                          )}
                        </Link>
                      </div>,
                      <Link
                        key={user.id}
                        to={`/app/tableau-de-bord/admin/user/${user.id}`}
                        className="no-scrollbar inline-flex! size-full items-start justify-start self-stretch overflow-x-auto! border-r border-r-gray-200 bg-none! no-underline!"
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
                      selectedTabId === 'chasseurs-a-activer' ? (
                        <Link
                          key={user.id}
                          to={`/app/tableau-de-bord/admin/user/${user.id}`}
                          className="no-scrollbar inline-flex! size-full flex-col items-start justify-start overflow-x-auto! border-r border-r-gray-200 bg-none! no-underline!"
                        >
                          <span className="font-medium">CFEI: {user.numero_cfei || 'Non renseigné'}</span>
                          <br />
                          <span>
                            Formation: {user.est_forme_a_l_examen_initial ? '✅ Formé' : '❌ Non formé'}
                          </span>
                          <br />
                          <span className="text-sm text-gray-500">
                            Onboarding: {user.onboarded_at ? '✅ Terminé' : '❌ Incomplet'}
                          </span>
                        </Link>
                      ) : (
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
                        </Link>
                      ),
                      <div
                        key={user.email}
                        className="no-scrollbar inline-flex! size-full flex-col items-center justify-center gap-2 overflow-x-auto! border-r border-r-gray-200 p-2"
                      >
                        {selectedTabId === 'chasseurs-a-activer' && (
                          <Button
                            size="small"
                            priority="primary"
                            onClick={() => {
                              API.post({
                                path: `admin/user/${user.id}`,
                                body: {
                                  activated: 'true',
                                },
                              }).then((res) => {
                                if (res.ok) {
                                  setUsers((prev) =>
                                    prev.map((u) => (u.id === user.id ? { ...u, activated: true } : u)),
                                  );
                                }
                              });
                            }}
                          >
                            Activer
                          </Button>
                        )}
                        <form
                          method="POST"
                          onSubmit={(event) => {
                            event.preventDefault();

                            API.post({
                              path: 'admin/user/connect-as',
                              body: {
                                email: user.email!,
                              },
                            })
                              .then(async () => {
                                await clearCache();
                                await refreshUser('admin/user/connect-as');
                              })
                              .then(() => {
                                window.location.href = '/app/tableau-de-bord';
                              });
                          }}
                        >
                          <button type="submit" className="text-action-high-blue-france text-center text-sm">
                            Se connecter en tant que
                            <br />
                            {user.email}
                          </button>
                        </form>
                      </div>,
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
