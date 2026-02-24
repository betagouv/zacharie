import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
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
    if (selectedRole) {
      if (!user.roles?.includes(selectedRole as UserRoles)) {
        return false;
      }
    }
    if (selectedCfeiStatus) {
      if (selectedCfeiStatus === 'with_cfei' && !user.numero_cfei) return false;
      if (selectedCfeiStatus === 'without_cfei' && user.numero_cfei) return false;
      if (selectedCfeiStatus === 'trained' && !user.est_forme_a_l_examen_initial) return false;
    }
    if (selectedOnboardingStatus) {
      if (selectedOnboardingStatus === 'completed' && !user.onboarded_at) return false;
      if (selectedOnboardingStatus === 'incomplete' && user.onboarded_at) return false;
    }
    if (selectedCfeiValidation && officialCfeis.length > 0) {
      const validationStatus = getCfeiValidationStatus(user);
      if (selectedCfeiValidation === 'valid' && validationStatus !== 'valid') return false;
      if (selectedCfeiValidation === 'invalid' && validationStatus !== 'invalid') return false;
      if (selectedCfeiValidation === 'missing' && validationStatus !== 'missing') return false;
    }
    return true;
  });

  const chasseursToActivate = filteredUsers.filter(
    (user) => !user.activated && user.roles?.includes(UserRoles.CHASSEUR),
  );

  const tabs: TabsProps['tabs'] = [
    { tabId: 'all', label: `Tous (${filteredUsers.length})` },
    { tabId: 'chasseurs-a-activer', label: `Chasseurs à activer (${chasseursToActivate.length})` },
    { tabId: 'activated', label: `Activés (${filteredUsers.filter((user) => user.activated).length})` },
    { tabId: 'deactivated', label: `Désactivés (${filteredUsers.filter((user) => !user.activated).length})` },
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
      <div className="mb-2 flex items-center justify-end">

      </div>
      <div className="flex flex-wrap items-end gap-2 pb-2 [&_.fr-label]:text-xs [&_.fr-input-group]:mb-0 [&_.fr-select-group]:mb-0">
        <Input
          className="w-56"
          label="Recherche"
          nativeInputProps={{
            type: 'search',
            value: searchQuery,
            onChange: (e) => setSearchQuery(e.target.value),
            placeholder: 'Nom, email, tél, CFEI...',
          }}
        />
        <Select
          className="w-40"
          label="Rôle"
          nativeSelectProps={{
            value: selectedRole,
            onChange: (e) => setSelectedRole(e.target.value),
          }}
        >
          <option value="">Tous</option>
          {uniqueRoles.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </Select>
        <Select
          className="w-44"
          label="CFEI"
          nativeSelectProps={{
            value: selectedCfeiStatus,
            onChange: (e) => setSelectedCfeiStatus(e.target.value),
          }}
        >
          <option value="">Tous</option>
          <option value="with_cfei">Avec CFEI</option>
          <option value="without_cfei">Sans CFEI</option>
          <option value="trained">Formé EI</option>
        </Select>
        <Select
          className="w-44"
          label="Onboarding"
          nativeSelectProps={{
            value: selectedOnboardingStatus,
            onChange: (e) => setSelectedOnboardingStatus(e.target.value),
          }}
        >
          <option value="">Tous</option>
          <option value="completed">Terminé</option>
          <option value="incomplete">Incomplet</option>
        </Select>
        {officialCfeis.length > 0 && (
          <Select
            className="w-44"
            label="Validation CFEI"
            nativeSelectProps={{
              value: selectedCfeiValidation,
              onChange: (e) => setSelectedCfeiValidation(e.target.value),
            }}
          >
            <option value="">Tous</option>
            <option value="valid">Validé</option>
            <option value="invalid">Non trouvé</option>
            <option value="missing">Non renseigné</option>
          </Select>
        )}
        <Button
          size="small"
          linkProps={{ to: '/app/tableau-de-bord/admin/add-user' }}
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
                    <tr key={user.id} className="border-b border-gray-200 align-top hover:bg-gray-50">
                      <td className="px-2 py-1">
                        <span className="flex flex-col">
                          <span className="font-medium">
                            <span className="text-xs text-gray-400">{index + 1}. </span>
                            <Link
                              to={`/app/tableau-de-bord/admin/user/${user.id}`}
                              className="no-underline"
                            >
                              {user.nom_de_famille} {user.prenom}
                            </Link>
                          </span>
                          <span className="text-xs">{user.email}</span>
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
                              <Badge key={role} severity="info" small>
                                {role}
                              </Badge>
                            ))}
                          </span>
                          {isChasseur && (
                            <span className="flex flex-col gap-0.5 text-xs">
                              <span>
                                {user.numero_cfei || (
                                  <span className="italic text-gray-400">—</span>
                                )}
                                {officialCfeis.length > 0 && cfeiStatus === 'valid' && (
                                  <Badge severity="success" small className="ml-1">Validé</Badge>
                                )}
                                {officialCfeis.length > 0 && cfeiStatus === 'invalid' && (
                                  <Badge severity="error" small className="ml-1">Non trouvé</Badge>
                                )}
                                {officialCfeis.length > 0 && cfeiStatus === 'missing' && (
                                  <Badge severity="warning" small className="ml-1">Non renseigné</Badge>
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
                            <Badge severity={user.activated ? 'success' : 'error'} small>
                              {user.activated ? 'Activé' : 'Inactif'}
                            </Badge>
                            <Badge severity={user.onboarded_at ? 'success' : 'warning'} small>
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
                          <span className="text-xs text-gray-500" suppressHydrationWarning>
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
                                body: { email: user.email! },
                              });
                              navigate('/app/tableau-de-bord', { replace: true });
                              await clearCache();
                              await refreshUser('admin/user/connect-as');
                            }}
                          >
                            <button
                              type="submit"
                              className="text-action-high-blue-france text-center text-xs"
                            >
                              Connexion
                            </button>
                          </form>
                        </span>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
        <div className="flex items-start bg-white px-4 py-2">
          <a className="fr-link fr-icon-arrow-up-fill fr-link--icon-left text-sm" href="#top">
            Haut de page
          </a>
        </div>
      </Tabs>
    </div>
  );
}
