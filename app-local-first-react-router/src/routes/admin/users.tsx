import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Badge } from '@codegouvfr/react-dsfr/Badge';
import { UserRoles } from '@prisma/client';
import dayjs from 'dayjs';
import type { AdminUsersResponse, AdminOfficialCfeisResponse, OfficialCfei } from '@api/src/types/responses';
import Chargement from '@app/components/Chargement';
import FiltersSidebar from '@app/components/FiltersSidebar';
import CheckboxFilterSection from '@app/components/CheckboxFilterSection';
import { Tabs, type TabsProps } from '@codegouvfr/react-dsfr/Tabs';
import API from '@app/services/api';

import ConnexionButton from '@app/components/ConnexionButton';

type CfeiValidationStatus = 'valid' | 'invalid' | 'missing';

export default function AdminUsers() {
  const [users, setUsers] = useState<NonNullable<AdminUsersResponse['data']['users']>>([]);
  const [officialCfeis, setOfficialCfeis] = useState<Array<OfficialCfei>>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedCfeiStatuses, setSelectedCfeiStatuses] = useState<string[]>([]);
  const [selectedCfeiValidations, setSelectedCfeiValidations] = useState<string[]>([]);
  const [selectedOnboardingStatuses, setSelectedOnboardingStatuses] = useState<string[]>([]);

  const officialCfeiMap = useMemo(() => {
    const map = new Map<string, OfficialCfei>();
    officialCfeis.forEach((cfei) => {
      map.set(cfei.numero_cfei.toUpperCase(), cfei);
    });
    return map;
  }, [officialCfeis]);

  const getCfeiValidationStatus = (user: { numero_cfei: string | null }): CfeiValidationStatus => {
    if (!user.numero_cfei) return 'missing';
    return officialCfeiMap.has(user.numero_cfei.toUpperCase()) ? 'valid' : 'invalid';
  };

  const getOfficialCfeiDetails = (user: { numero_cfei: string | null }): OfficialCfei | null => {
    if (!user.numero_cfei) return null;
    return officialCfeiMap.get(user.numero_cfei.toUpperCase()) || null;
  };

  const uniqueRoles = useMemo(() => {
    const rolesSet = new Set<UserRoles>();
    users.forEach((user) => {
      user.roles?.forEach((role) => rolesSet.add(role));
    });
    return Array.from(rolesSet).sort();
  }, [users]);

  const filteredUsers = users.filter((user) => {
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
    if (selectedRoles.length) {
      if (!selectedRoles.some((role) => user.roles?.includes(role as UserRoles))) {
        return false;
      }
    }
    if (selectedCfeiStatuses.length) {
      const match = selectedCfeiStatuses.some((status) => {
        if (status === 'with_cfei') return !!user.numero_cfei;
        if (status === 'without_cfei') return !user.numero_cfei;
        if (status === 'trained') return user.est_forme_a_l_examen_initial;
        return false;
      });
      if (!match) return false;
    }
    if (selectedOnboardingStatuses.length) {
      const match = selectedOnboardingStatuses.some((status) => {
        if (status === 'completed') return !!user.onboarded_at;
        if (status === 'incomplete') return !user.onboarded_at;
        return false;
      });
      if (!match) return false;
    }
    if (selectedCfeiValidations.length && officialCfeis.length > 0) {
      if (!selectedCfeiValidations.includes(getCfeiValidationStatus(user))) return false;
    }
    return true;
  });

  const chasseursToActivate = filteredUsers.filter(
    (user) => !user.activated && !user.deleted_at && user.roles?.includes(UserRoles.CHASSEUR)
  );

  const tabs: TabsProps['tabs'] = [
    { tabId: 'all', label: `Tous (${filteredUsers.filter((user) => !user.deleted_at).length})` },
    { tabId: 'chasseurs-a-activer', label: `Chasseurs à activer (${chasseursToActivate.length})` },
    {
      tabId: 'activated',
      label: `Activés (${filteredUsers.filter((user) => user.activated && !user.deleted_at).length})`,
    },
    {
      tabId: 'deactivated',
      label: `Désactivés (${filteredUsers.filter((user) => !user.activated && !user.deleted_at).length})`,
    },
    { tabId: 'deleted', label: `Supprimés (${filteredUsers.filter((user) => user.deleted_at).length})` },
  ];
  const [selectedTabId, setSelectedTabId] = useState(tabs[0].tabId);

  useEffect(() => {
    Promise.all([
      API.get({ path: 'admin/users' }).then((res) => res as AdminUsersResponse),
      API.get({ path: 'admin/official-cfeis' }).then((res) => res as AdminOfficialCfeisResponse),
    ]).then(([usersRes, cfeisRes]) => {
      if (usersRes.ok) setUsers(usersRes.data.users);
      if (cfeisRes.ok) setOfficialCfeis(cfeisRes.data.officialCfeis);
    });
  }, []);

  if (!users?.length) {
    return <Chargement />;
  }

  return (
    <div className="py-2">
      <title>
        Utilisateurs | Admin | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire
      </title>
      <div className="md:flex">
        <FiltersSidebar
          storageKey="admin-users-filters"
          activeFilterCount={
            (searchQuery.trim() ? 1 : 0) +
            selectedRoles.length +
            selectedCfeiStatuses.length +
            selectedOnboardingStatuses.length +
            selectedCfeiValidations.length
          }
          onReset={() => {
            setSearchQuery('');
            setSelectedRoles([]);
            setSelectedCfeiStatuses([]);
            setSelectedOnboardingStatuses([]);
            setSelectedCfeiValidations([]);
          }}
        >
          <div className="relative">
            <span
              className="fr-icon--sm fr-icon-search-line absolute top-1/2 left-3 -translate-y-1/2 text-gray-400"
              aria-hidden="true"
            />
            <input
              type="search"
              placeholder="Nom, email, tél, CFEI..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded border border-gray-300 py-2 pr-3 pl-10 text-sm transition-colors outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <CheckboxFilterSection
            title="Rôle"
            scroll
            options={uniqueRoles.map((role) => ({ value: role, label: role }))}
            selected={selectedRoles}
            onChange={setSelectedRoles}
          />
          <CheckboxFilterSection
            title="CFEI"
            options={[
              { value: 'with_cfei', label: 'Avec CFEI' },
              { value: 'without_cfei', label: 'Sans CFEI' },
              { value: 'trained', label: 'Formé EI' },
            ]}
            selected={selectedCfeiStatuses}
            onChange={setSelectedCfeiStatuses}
          />
          <CheckboxFilterSection
            title="Onboarding"
            options={[
              { value: 'completed', label: 'Terminé' },
              { value: 'incomplete', label: 'Incomplet' },
            ]}
            selected={selectedOnboardingStatuses}
            onChange={setSelectedOnboardingStatuses}
          />
          {officialCfeis.length > 0 && (
            <CheckboxFilterSection
              title="Validation CFEI"
              options={[
                { value: 'valid', label: 'Validé' },
                { value: 'invalid', label: 'Non trouvé' },
                { value: 'missing', label: 'Non renseigné' },
              ]}
              selected={selectedCfeiValidations}
              onChange={setSelectedCfeiValidations}
            />
          )}
        </FiltersSidebar>
        <div className="min-w-0 flex-1 md:px-4">
          <div className="mb-2 flex items-center justify-end">
            <Button
              size="small"
              linkProps={{ to: '/app/admin/add-user' }}
            >
              + Ajouter des utilisateurs
            </Button>
          </div>
          <Tabs
            selectedTabId={selectedTabId}
            tabs={tabs}
            onTabChange={setSelectedTabId}
            className="[&_.fr-tabs\_\_list]:bg-alt-blue-france! bg-white [&_.fr-tabs\_\_list]:shadow-none!"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-300 text-xs text-gray-600 uppercase">
                    <th className="px-2 py-1">Identité</th>
                    <th className="px-2 py-1">Rôles & CFEI</th>
                    <th className="px-2 py-1">Statut</th>
                    <th className="px-2 py-1">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers
                    .filter((user) => {
                      if (selectedTabId === 'deleted') return !!user.deleted_at;
                      if (user.deleted_at) return false;
                      if (selectedTabId === 'chasseurs-a-activer')
                        return !user.activated && user.roles?.includes(UserRoles.CHASSEUR);
                      if (selectedTabId === 'activated') return user.activated;
                      if (selectedTabId === 'deactivated') return !user.activated;
                      return true;
                    })
                    .map((user, index) => {
                      const isChasseur = user.roles?.includes(UserRoles.CHASSEUR);
                      const cfeiStatus = isChasseur ? getCfeiValidationStatus(user) : null;
                      const officialDetails = isChasseur ? getOfficialCfeiDetails(user) : null;

                      return (
                        <tr
                          key={user.id}
                          className="border-b border-gray-200 align-top hover:bg-gray-50"
                        >
                          <td className="px-2 py-1">
                            <span className="flex flex-col">
                              <span className="font-medium">
                                <span className="text-xs text-gray-400">{index + 1}. </span>
                                <Link
                                  to={`/app/admin/user/${user.id}`}
                                  className="no-underline"
                                >
                                  {[user.nom_de_famille, user.prenom].filter(Boolean).join(' ') ||
                                    user.email ||
                                    'Voir le détail'}
                                </Link>
                              </span>
                              {[user.nom_de_famille, user.prenom].some(Boolean) && (
                                <span className="text-xs">{user.email}</span>
                              )}
                              {(user.telephone || user.code_postal || user.ville) && (
                                <span className="text-xs text-gray-500">
                                  {[user.telephone, [user.code_postal, user.ville].filter(Boolean).join(' ')]
                                    .filter(Boolean)
                                    .join(' · ')}
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="px-2 py-1">
                            <span className="flex flex-col gap-1">
                              <span className="flex flex-wrap gap-0.5">
                                {user.roles.map((role) => (
                                  <Badge
                                    key={role}
                                    severity="info"
                                    small
                                  >
                                    {role}
                                  </Badge>
                                ))}
                                {user.isZacharieAdmin && (
                                  <Badge
                                    severity="info"
                                    small
                                  >
                                    Admin
                                  </Badge>
                                )}
                              </span>
                              {isChasseur && (
                                <span className="flex flex-col gap-0.5 text-xs">
                                  <span>
                                    {user.numero_cfei || <span className="text-gray-400 italic">—</span>}
                                    {officialCfeis.length > 0 && cfeiStatus === 'valid' && (
                                      <Badge
                                        severity="success"
                                        small
                                        className="ml-1"
                                      >
                                        Validé
                                      </Badge>
                                    )}
                                    {officialCfeis.length > 0 && cfeiStatus === 'invalid' && (
                                      <Badge
                                        severity="error"
                                        small
                                        className="ml-1"
                                      >
                                        Non trouvé
                                      </Badge>
                                    )}
                                    {officialCfeis.length > 0 && cfeiStatus === 'missing' && (
                                      <Badge
                                        severity="warning"
                                        small
                                        className="ml-1"
                                      >
                                        Non renseigné
                                      </Badge>
                                    )}
                                  </span>
                                  {officialDetails && (
                                    <span className="text-gray-500">
                                      {officialDetails.prenom} {officialDetails.nom}
                                      {officialDetails.departement && ` — ${officialDetails.departement}`}
                                    </span>
                                  )}
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="px-2 py-1">
                            <span className="flex flex-col gap-0.5">
                              <span className="flex flex-wrap gap-0.5">
                                {user.deleted_at && (
                                  <Badge
                                    severity="error"
                                    small
                                  >
                                    Supprimé
                                  </Badge>
                                )}
                                <Badge
                                  severity={user.activated ? 'success' : 'error'}
                                  small
                                >
                                  {user.activated ? 'Activé' : 'Inactif'}
                                </Badge>
                                <Badge
                                  severity={user.onboarded_at ? 'success' : 'warning'}
                                  small
                                >
                                  {user.onboarded_at ? 'Onboardé' : 'Onb. incomplet'}
                                </Badge>
                                {isChasseur && (
                                  <Badge
                                    severity={user.est_forme_a_l_examen_initial ? 'success' : 'warning'}
                                    small
                                  >
                                    {user.est_forme_a_l_examen_initial ? 'Formé EI' : 'Non formé EI'}
                                  </Badge>
                                )}
                              </span>
                              <span
                                className="text-xs text-gray-500"
                                suppressHydrationWarning
                              >
                                Créé {dayjs(user.created_at).format('DD/MM/YY')}
                                {user.last_seen_at && ` · Vu ${dayjs(user.last_seen_at).format('DD/MM/YY')}`}
                              </span>
                            </span>
                          </td>
                          <td className="px-2 py-1">
                            <span className="flex flex-col items-center gap-1">
                              {selectedTabId === 'chasseurs-a-activer' && (
                                <Button
                                  size="small"
                                  priority="primary"
                                  onClick={() => {
                                    API.post({
                                      path: `admin/user/${user.id}`,
                                      body: { activated: 'true' },
                                    }).then((res) => {
                                      if (res.ok) {
                                        setUsers((prev) =>
                                          prev.map((u) => (u.id === user.id ? { ...u, activated: true } : u))
                                        );
                                      }
                                    });
                                  }}
                                >
                                  Activer
                                </Button>
                              )}
                              <ConnexionButton
                                user={user}
                                type="tertiary no outline"
                              />
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
            <div className="flex items-start bg-white px-4 py-2">
              <a
                className="fr-link fr-icon-arrow-up-fill fr-link--icon-left text-sm"
                href="#top"
              >
                Haut de page
              </a>
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
