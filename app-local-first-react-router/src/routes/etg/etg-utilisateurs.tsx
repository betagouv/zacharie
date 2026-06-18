import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Tag } from '@codegouvfr/react-dsfr/Tag';
import type { EtgUsersInteractedResponse, EtgUserInteracted } from '@api/src/types/responses';
import { getUserRoleLabel } from '@app/utils/get-user-roles-label';
import API from '@app/services/api';
import Chargement from '@app/components/Chargement';
import CollapsibleSection from '@app/components/CollapsibleSection';

type RoleLabelArg = Parameters<typeof getUserRoleLabel>[0];

export default function EtgUtilisateurs() {
  const [users, setUsers] = useState<Array<EtgUserInteracted>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRoles, setFilterRoles] = useState<Array<string>>([]);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    API.get({ path: 'entite/etg/utilisateurs' })
      .then((res) => res as EtgUsersInteractedResponse)
      .then((res) => {
        if (res.ok && res.data) {
          setUsers(res.data.users);
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  const roleOptions = useMemo(() => {
    const set = new Set<string>();
    for (const user of users) {
      for (const role of user.roles) set.add(role);
    }
    return Array.from(set).sort((a, b) =>
      getUserRoleLabel(a as RoleLabelArg).localeCompare(getUserRoleLabel(b as RoleLabelArg))
    );
  }, [users]);

  const filteredUsers = useMemo(() => {
    let result = users;
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter((user) =>
        [user.prenom, user.nom_de_famille, user.email, user.telephone, user.ville, user.code_postal]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(q))
      );
    }
    if (filterRoles.length > 0) {
      result = result.filter((user) => user.roles.some((role) => filterRoles.includes(role)));
    }
    return result;
  }, [users, searchQuery, filterRoles]);

  const activeFiltersCount = filterRoles.length + (searchQuery.trim() ? 1 : 0);
  const hasActiveFilters = activeFiltersCount > 0;

  const clearAllFilters = () => {
    setSearchQuery('');
    setFilterRoles([]);
  };

  const toggleRole = (role: string) => {
    setFilterRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));
  };

  const sidebarContent = (
    <>
      {/* Recherche */}
      <div className="relative">
        <span
          className="fr-icon--sm fr-icon-search-line absolute top-1/2 left-3 -translate-y-1/2 text-gray-400"
          aria-hidden="true"
        />
        <input
          type="search"
          placeholder="Rechercher un utilisateur..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded border border-gray-300 py-2 pr-3 pl-10 text-sm transition-colors outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Compteur */}
      <div className="mt-2 flex items-center justify-between border-b border-gray-200 pb-3">
        <span className="text-sm font-medium text-gray-600">
          {filteredUsers.length} utilisateur{filteredUsers.length > 1 ? 's' : ''}
        </span>
        {hasActiveFilters && (
          <button
            className="text-action-high-blue-france text-xs underline"
            onClick={clearAllFilters}
          >
            Réinitialiser
          </button>
        )}
      </div>

      {/* Filtre Rôle */}
      {roleOptions.length > 1 && (
        <CollapsibleSection
          title="Rôle"
          defaultOpen={false}
          badge={
            filterRoles.length > 0 ? (
              <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-xs text-blue-800">
                {filterRoles.length}
              </span>
            ) : undefined
          }
        >
          <div className="flex max-h-60 flex-col gap-1 overflow-y-auto">
            {roleOptions.map((role) => (
              <label
                key={role}
                className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={filterRoles.includes(role)}
                  className="checked:accent-action-high-blue-france h-4 w-4 shrink-0"
                  onChange={() => toggleRole(role)}
                />
                <span className="truncate text-sm">{getUserRoleLabel(role as RoleLabelArg)}</span>
              </label>
            ))}
          </div>
        </CollapsibleSection>
      )}
    </>
  );

  if (isLoading) {
    return <Chargement />;
  }

  return (
    <div className="relative">
      <title>{`Utilisateurs | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire`}</title>

      {/* Mobile : bouton filtres sticky */}
      <div className="fr-background-alt--blue-france sticky top-0 z-30 flex items-center justify-between px-4 py-2 md:hidden">
        <span className="text-sm font-medium">
          {filteredUsers.length} utilisateur{filteredUsers.length > 1 ? 's' : ''}
        </span>
        <button
          type="button"
          aria-label="Filtres"
          className="relative flex h-10 items-center gap-1 rounded border border-gray-300 bg-white px-2 text-sm text-gray-700 transition-colors hover:bg-gray-50"
          onClick={() => setShowMobileFilters(!showMobileFilters)}
        >
          <span
            className="fr-icon--sm ri-filter-3-line"
            aria-hidden="true"
          />
          <span>Filtres</span>
          {hasActiveFilters && (
            <span className="bg-action-high-blue-france ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white">
              {activeFiltersCount}
            </span>
          )}
        </button>
      </div>

      {/* Mobile : panneau filtres */}
      {showMobileFilters && (
        <div className="fixed inset-0 z-[800] md:hidden">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setShowMobileFilters(false)}
          />
          <div className="absolute top-0 right-0 bottom-0 w-80 overflow-y-auto bg-white p-4 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Filtres</h2>
              <button
                className="text-action-high-blue-france text-sm underline"
                onClick={() => setShowMobileFilters(false)}
              >
                Fermer
              </button>
            </div>
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Layout principal */}
      <div className="flex">
        {/* Sidebar gauche - desktop, collée au bord */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 overflow-y-auto border-r border-gray-200 bg-white p-4 md:block">
          {sidebarContent}
        </aside>

        {/* Contenu principal */}
        <div className="min-w-0 flex-1 px-4 pt-4 md:px-6">
          <h1 className="fr-h2 fr-mb-1w">Utilisateurs</h1>
          <p className="fr-text--sm mb-4 text-gray-600">
            Liste des utilisateurs ayant interagi au moins une fois avec votre établissement (premiers
            détenteurs, examinateurs, collecteurs, services vétérinaires).
          </p>

          {filteredUsers.length === 0 ? (
            <div className="bg-white p-8 text-center text-gray-600 md:shadow-sm">
              Aucun utilisateur ne correspond à votre recherche.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredUsers.map((user) => (
                <UserCard
                  key={user.id}
                  user={user}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getUserName(user: EtgUserInteracted) {
  const name = `${user.prenom ?? ''} ${user.nom_de_famille ?? ''}`.trim();
  return name || user.email || 'Utilisateur sans nom';
}

function UserCard({ user }: { user: EtgUserInteracted }) {
  const localisation = [user.code_postal, user.ville].filter(Boolean).join(' ');
  return (
    <div className="flex flex-col bg-white p-4 shadow-sm">
      <Link
        to={`/app/etg/utilisateurs/${user.id}`}
        className="font-bold text-gray-900 hover:underline"
      >
        {getUserName(user)}
      </Link>

      {user.roles.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {user.roles.map((role) => (
            <Tag
              key={role}
              small
            >
              {getUserRoleLabel(role)}
            </Tag>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-col gap-1.5 text-sm">
        {user.email ? (
          <div>
            <span className="fr-icon-mail-line fr-link--icon-left text-black" />
            <a
              className="fr-link fr-link--icon-left w-fit max-w-full self-start text-sm break-all"
              href={`mailto:${user.email}`}
            >
              {user.email}
            </a>
          </div>
        ) : (
          <span className="fr-icon-mail-line fr-link--icon-left flex w-fit items-center gap-1 self-start text-gray-400">
            Email non renseigné
          </span>
        )}
        {user.telephone ? (
          <div>
            <span className="fr-icon-phone-line fr-link--icon-left text-black" />
            <a
              className="fr-link fr-link--icon-left w-fit max-w-full self-start text-sm"
              href={`tel:${user.telephone}`}
            >
              {user.telephone}
            </a>
          </div>
        ) : (
          <span className="fr-icon-phone-line fr-link--icon-left flex w-fit items-center gap-1 self-start text-gray-400">
            Téléphone non renseigné
          </span>
        )}
        <span className="fr-icon-map-pin-2-line fr-link--icon-left flex w-fit items-center gap-1 self-start text-gray-700">
          {localisation || <span className="text-gray-400">Localisation non renseignée</span>}
        </span>
      </div>
    </div>
  );
}
