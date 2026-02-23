import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Table } from '@codegouvfr/react-dsfr/Table';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { Select } from '@codegouvfr/react-dsfr/Select';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Badge } from '@codegouvfr/react-dsfr/Badge';
import { UserRoles } from '@prisma/client';
import dayjs from 'dayjs';
import type { AdminUsersResponse, AdminOfficialCfeisResponse, OfficialCfei } from '@api/src/types/responses';
import Chargement from '@app/components/Chargement';
import { Tabs, type TabsProps } from '@codegouvfr/react-dsfr/Tabs';
import API from '@app/services/api';
import { clearCache } from '@app/services/indexed-db';
import { refreshUser } from '@app/utils-offline/get-most-fresh-user';

type CfeiValidationStatus = 'valid' | 'invalid' | 'missing';

export default function AdminUsers() {
  const [users, setUsers] = useState<NonNullable<AdminUsersResponse['data']['users']>>([]);
  const [officialCfeis, setOfficialCfeis] = useState<Array<OfficialCfei>>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [selectedCfeiStatus, setSelectedCfeiStatus] = useState<string>('');
  const [selectedCfeiValidation, setSelectedCfeiValidation] = useState<string>('');
  const [selectedOnboardingStatus, setSelectedOnboardingStatus] = useState<string>('');
  const navigate = useNavigate();

  // Create a map of official CFEIs for quick lookup
  const officialCfeiMap = useMemo(() => {
    const map = new Map<string, OfficialCfei>();
    officialCfeis.forEach((cfei) => {
      map.set(cfei.numero_cfei.toUpperCase(), cfei);
    });
    return map;
  }, [officialCfeis]);

  // Get CFEI validation status for a user
  const getCfeiValidationStatus = (user: { numero_cfei: string | null }): CfeiValidationStatus => {
    if (!user.numero_cfei) return 'missing';
    return officialCfeiMap.has(user.numero_cfei.toUpperCase()) ? 'valid' : 'invalid';
  };

  // Get official CFEI details for a user
  const getOfficialCfeiDetails = (user: { numero_cfei: string | null }): OfficialCfei | null => {
    if (!user.numero_cfei) return null;
    return officialCfeiMap.get(user.numero_cfei.toUpperCase()) || null;
  };

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

    // CFEI validation filter (only applies when official list is loaded)
    if (selectedCfeiValidation && officialCfeis.length > 0) {
      const validationStatus = getCfeiValidationStatus(user);
      if (selectedCfeiValidation === 'valid' && validationStatus !== 'valid') {
        return false;
      }
      if (selectedCfeiValidation === 'invalid' && validationStatus !== 'invalid') {
        return false;
      }
      if (selectedCfeiValidation === 'missing' && validationStatus !== 'missing') {
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
    // Fetch users and official CFEI list in parallel
    Promise.all([
      API.get({ path: 'admin/users' }).then((res) => res as AdminUsersResponse),
      API.get({ path: 'admin/official-cfeis' }).then((res) => res as AdminOfficialCfeisResponse),
    ]).then(([usersRes, cfeisRes]) => {
      if (usersRes.ok) {
        setUsers(usersRes.data.users);
      }
      if (cfeisRes.ok) {
        setOfficialCfeis(cfeisRes.data.officialCfeis);
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
                {officialCfeis.length > 0 && (
                  <Select
                    label="Validation CFEI officiel"
                    nativeSelectProps={{
                      value: selectedCfeiValidation,
                      onChange: (e) => setSelectedCfeiValidation(e.target.value),
                    }}
                  >
                    <option value="">Tous</option>
                    <option value="valid">CFEI validé</option>
                    <option value="invalid">CFEI non trouvé</option>
                    <option value="missing">CFEI non renseigné</option>
                  </Select>
                )}
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
                  headers={['Identité', 'Rôles & CFEI', 'Statut', 'Actions']}
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
                    .map((user, index) => {
                      const isChasseur = user.roles?.includes(UserRoles.CHASSEUR);
                      const cfeiStatus = isChasseur ? getCfeiValidationStatus(user) : null;
                      const officialDetails = isChasseur ? getOfficialCfeiDetails(user) : null;

                      return [
                        <Link
                          key={user.id}
                          to={`/app/tableau-de-bord/admin/user/${user.id}`}
                          className="inline-flex! size-full flex-col items-start justify-start gap-1 border-r border-r-gray-200 bg-none! no-underline!"
                        >
                          <span className="font-bold">
                            {index + 1}. {user.nom_de_famille} {user.prenom}
                          </span>
                          <span className="text-sm">{user.email}</span>
                          {user.telephone && <span className="text-sm text-gray-500">{user.telephone}</span>}
                          <span className="text-sm text-gray-500">
                            {user.code_postal} {user.ville}
                          </span>
                        </Link>,
                        <Link
                          key={user.id}
                          to={`/app/tableau-de-bord/admin/user/${user.id}`}
                          className="no-scrollbar inline-flex! size-full flex-col items-start justify-start gap-1 overflow-x-auto! border-r border-r-gray-200 bg-none! no-underline!"
                        >
                          <span className="flex flex-wrap gap-1">
                            {user.roles.map((role) => (
                              <Badge key={role} severity="info" small>
                                {role}
                              </Badge>
                            ))}
                          </span>
                          {isChasseur && (
                            <span className="mt-1 flex flex-col gap-1">
                              <span className="text-sm">
                                {user.numero_cfei || (
                                  <span className="italic text-gray-400">CFEI non renseigné</span>
                                )}
                              </span>
                              {officialCfeis.length > 0 &&
                                (() => {
                                  if (cfeiStatus === 'valid') {
                                    return (
                                      <>
                                        <Badge severity="success" small>
                                          CFEI validé
                                        </Badge>
                                        {officialDetails && (
                                          <span className="text-xs text-gray-600">
                                            {officialDetails.prenom} {officialDetails.nom}
                                            {officialDetails.departement &&
                                              ` — Dép. ${officialDetails.departement}`}
                                          </span>
                                        )}
                                      </>
                                    );
                                  }
                                  if (cfeiStatus === 'invalid') {
                                    return (
                                      <Badge severity="error" small>
                                        CFEI non trouvé
                                      </Badge>
                                    );
                                  }
                                  return (
                                    <Badge severity="warning" small>
                                      CFEI non renseigné
                                    </Badge>
                                  );
                                })()}
                            </span>
                          )}
                        </Link>,
                        <Link
                          key={user.id}
                          to={`/app/tableau-de-bord/admin/user/${user.id}`}
                          className="inline-flex! size-full flex-col items-start justify-start gap-1 border-r border-r-gray-200 bg-none! no-underline!"
                          suppressHydrationWarning
                        >
                          <Badge severity={user.activated ? 'success' : 'error'} small>
                            {user.activated ? 'Activé' : 'Inactif'}
                          </Badge>
                          <Badge severity={user.onboarded_at ? 'success' : 'warning'} small>
                            {user.onboarded_at ? 'Onboardé' : 'Onboarding incomplet'}
                          </Badge>
                          {isChasseur && (
                            <Badge
                              severity={user.est_forme_a_l_examen_initial ? 'success' : 'warning'}
                              small
                            >
                              {user.est_forme_a_l_examen_initial ? 'Formé EI' : 'Non formé EI'}
                            </Badge>
                          )}
                          <span className="mt-1 text-xs text-gray-500" suppressHydrationWarning>
                            Créé le {dayjs(user.created_at).format('DD/MM/YYYY')}
                          </span>
                          {user.last_seen_at && (
                            <span className="text-xs text-gray-500" suppressHydrationWarning>
                              Vu le {dayjs(user.last_seen_at).format('DD/MM/YYYY')}
                            </span>
                          )}
                        </Link>,
                        <div
                          key={user.email}
                          className="no-scrollbar inline-flex! size-full flex-col items-center justify-center gap-2 overflow-x-auto! p-2"
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
                            onSubmit={async (event) => {
                              event.preventDefault();
                              await API.post({
                                path: 'admin/user/connect-as',
                                body: {
                                  email: user.email!,
                                },
                              })
                              navigate('/app/tableau-de-bord', { replace: true });
                              await clearCache();
                              await refreshUser('admin/user/connect-as');
                            }}
                          >
                            <button
                              type="submit"
                              className="text-action-high-blue-france text-center text-sm"
                            >
                              Se connecter en tant que
                              <br />
                              {user.email}
                            </button>
                          </form>
                        </div>,
                      ];
                    })}
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
