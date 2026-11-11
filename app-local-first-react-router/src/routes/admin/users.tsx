import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Badge } from '@codegouvfr/react-dsfr/Badge';
import { UserEtgRoles, UserRoles } from '@prisma/client';
import dayjs from 'dayjs';
import type { AdminUserRow, AdminUsersResponse } from '@api/src/types/responses';
import Chargement from '@app/components/Chargement';
import FiltersSidebar from '@app/components/FiltersSidebar';
import CheckboxFilterSection from '@app/components/CheckboxFilterSection';
import API from '@app/services/api';

import ConnexionButton from '@app/components/ConnexionButton';
import AdminViews, { type AdminView } from './admin-views';
import { toApiQuery, useDebouncedUrlText, usePageOffset, useUrlFilters, useUrlList } from './use-url-filters';

const LIMIT = 100;

// Toutes les valeurs de rôle, plus les deux sous-rôles ETG placés juste après ETG.
const ROLE_OPTIONS: Array<{ value: string; label: string }> = Object.values(UserRoles)
  .sort()
  .flatMap((role) =>
    role === UserRoles.ETG
      ? [
          { value: role, label: role },
          { value: 'ETG_TRANSPORT', label: 'ETG (transport)' },
          { value: 'ETG_RECEPTION', label: 'ETG (gestion)' },
        ]
      : [{ value: role, label: role }]
  );

const USER_VIEWS: Array<AdminView> = [
  { label: 'Tous', params: {} },
  { label: 'Onboarding incomplet', params: { onboarding: 'incomplete' } },
  { label: 'CFEI introuvable', params: { cfei_validation: 'invalid' } },
  { label: 'Chasseurs non formés EI', params: { roles: UserRoles.CHASSEUR, cfei: 'not_trained' } },
  { label: 'Désactivés', params: { statut: 'deactivated' } },
  { label: 'Bloqués', params: { statut: 'blocked' } },
  { label: 'Supprimés', params: { statut: 'deleted' } },
];

const statusIconColors = {
  green: 'text-green-600',
  red: 'text-red-600',
  orange: 'text-orange-500',
  grey: 'text-gray-400',
} as const;

function StatusIcon({
  icon,
  color,
  title,
}: {
  icon: string;
  color: keyof typeof statusIconColors;
  title: string;
}) {
  return (
    <span
      className={`${icon} fr-icon--sm ${statusIconColors[color]}`}
      title={title}
      aria-label={title}
      role="img"
    />
  );
}

const pillColors = {
  green: 'bg-green-100 text-green-800',
  red: 'bg-red-100 text-red-800',
  orange: 'bg-orange-100 text-orange-800',
  grey: 'bg-gray-200 text-gray-700',
} as const;

function Pill({
  color,
  children,
  title,
}: {
  color: keyof typeof pillColors;
  children: string;
  title?: string;
}) {
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap no-underline ${pillColors[color]}`}
      title={title}
    >
      {children}
    </span>
  );
}

function formatDate(date: Date | string | null) {
  return date ? dayjs(date).format('DD/MM/YY') : '—';
}

function cfeiTooltip(user: AdminUserRow) {
  if (user.cfei_validation === 'missing') return 'CFEI non renseigné';
  if (user.cfei_validation === 'invalid') return 'CFEI non trouvé';
  const official = user.official_cfei;
  if (!official) return 'CFEI validé';
  const nom = [official.prenom, official.nom].filter(Boolean).join(' ');
  return `CFEI validé : ${nom}${official.departement ? ` — ${official.departement}` : ''}`;
}

function UserTableRow({
  user,
  showCfeiValidation,
  onActivate,
}: {
  user: AdminUserRow;
  showCfeiValidation: boolean;
  onActivate: (userId: string) => void;
}) {
  const isChasseur = user.roles.includes(UserRoles.CHASSEUR);
  const fullName =
    [user.nom_de_famille, user.prenom].filter(Boolean).join(' ') || user.email || 'Voir le détail';

  return (
    <tr
      data-user-id={user.id}
      className={`border-b align-top hover:bg-blue-50 ${user.deleted_at ? 'text-gray-400' : ''}`}
    >
      <td className="max-w-[16rem] p-1">
        <div className="flex items-center gap-1">
          <Link
            to={`/app/admin/user/${user.id}`}
            className={`truncate font-medium ${user.deleted_at ? 'text-gray-400 line-through' : ''}`}
            title={fullName}
          >
            {fullName}
          </Link>
          {user.isZacharieAdmin && (
            <span
              className="fr-icon-admin-fill fr-icon--sm text-action-high-blue-france shrink-0"
              title="Administrateur"
              aria-label="Administrateur"
              role="img"
            />
          )}
        </div>
        {user.email && (
          <div
            className="truncate text-gray-500"
            title={user.email}
          >
            {user.email}
          </div>
        )}
        {user.telephone && <div className="text-gray-500">{user.telephone}</div>}
      </td>
      <td className="p-1">
        {user.roles.map((role) => (
          <Badge
            key={role}
            severity="info"
            small
          >
            {role === UserRoles.ETG
              ? `ETG ${user.etg_role === UserEtgRoles.TRANSPORT ? 'transport' : 'gestion'}`
              : role}
          </Badge>
        ))}
      </td>
      <td className="p-1">
        <div className="flex flex-wrap gap-1">
          {user.deleted_at ? (
            <Pill
              color="grey"
              title={`Supprimé le ${formatDate(user.deleted_at)}`}
            >
              Supprimé
            </Pill>
          ) : (
            <Pill color={user.activated ? 'green' : 'red'}>{user.activated ? 'Actif' : 'Inactif'}</Pill>
          )}
          {user.is_blocked && (
            <Pill
              color="orange"
              title="Trop d'échecs de connexion récents"
            >
              Bloqué
            </Pill>
          )}
        </div>
      </td>
      <td className="p-1">
        {user.onboarded_at ? (
          <span title={`Onboardé le ${formatDate(user.onboarded_at)}`}>✓</span>
        ) : (
          <Pill color="orange">Incomplet</Pill>
        )}
      </td>
      <td className="p-1 whitespace-nowrap">
        {isChasseur ? (
          <span className="flex items-center gap-1">
            <StatusIcon
              icon="fr-icon-award-fill"
              color={user.est_forme_a_l_examen_initial ? 'green' : 'red'}
              title={user.est_forme_a_l_examen_initial ? 'Formé EI' : 'Non formé EI'}
            />
            {showCfeiValidation && (
              <StatusIcon
                icon="fr-icon-shield-fill"
                color={
                  user.cfei_validation === 'valid'
                    ? 'green'
                    : user.cfei_validation === 'invalid'
                      ? 'red'
                      : 'grey'
                }
                title={cfeiTooltip(user)}
              />
            )}
            {user.numero_cfei || <span className="text-gray-400">—</span>}
          </span>
        ) : (
          <span className="text-gray-400">—</span>
        )}
      </td>
      <td className="max-w-[10rem] truncate p-1">
        {[user.code_postal, user.ville].filter(Boolean).join(' ') || '—'}
      </td>
      <td className="p-1 text-right tabular-nums">{user.nb_fiches}</td>
      <td className="p-1 text-right tabular-nums">{user.nb_carcasses}</td>
      <td className="p-1 whitespace-nowrap tabular-nums">{formatDate(user.last_login_at)}</td>
      <td className="p-1 whitespace-nowrap tabular-nums">{formatDate(user.created_at)}</td>
      <td className="p-1">
        <div className="flex items-center justify-end gap-1">
          {!user.activated && !user.deleted_at && isChasseur && (
            <Button
              size="small"
              priority="primary"
              onClick={() => onActivate(user.id)}
            >
              Activer
            </Button>
          )}
          {!user.deleted_at && (
            <ConnexionButton
              user={user}
              type="tertiary no outline"
            />
          )}
        </div>
      </td>
    </tr>
  );
}

export default function AdminUsers() {
  const [users, setUsers] = useState<Array<AdminUserRow>>([]);
  const [total, setTotal] = useState(0);
  const [hasOfficialCfeis, setHasOfficialCfeis] = useState(false);
  const [loading, setLoading] = useState(true);
  const { searchParams, setFilters, replaceFilters } = useUrlFilters();
  const offset = usePageOffset(searchParams, LIMIT);
  const urlSearchQuery = searchParams.get('q') ?? '';
  const [searchQuery, setSearchQuery] = useDebouncedUrlText(urlSearchQuery, (value) =>
    setFilters({ q: value }, { replace: true })
  );
  const selectedRoles = useUrlList(searchParams, 'roles');
  const selectedCfeiStatuses = useUrlList(searchParams, 'cfei');
  const selectedCfeiValidations = useUrlList(searchParams, 'cfei_validation');
  const selectedOnboardingStatuses = useUrlList(searchParams, 'onboarding');
  const selectedStatuses = useUrlList(searchParams, 'statut');
  const sortBy = searchParams.get('tri') || 'created_desc';
  const queryString = searchParams.toString();

  useEffect(() => {
    setLoading(true);
    const query = toApiQuery(new URLSearchParams(queryString), LIMIT, offset);
    API.get({ path: 'admin/users', query })
      .then((res) => res as AdminUsersResponse)
      .then((res) => {
        if (res.ok) {
          setUsers(res.data.users);
          setTotal(res.data.total);
          setHasOfficialCfeis(res.data.has_official_cfeis);
        }
      })
      .finally(() => setLoading(false));
  }, [queryString, offset]);

  const onActivate = useCallback((userId: string) => {
    API.post({
      path: `admin/user/${userId}`,
      body: { activated: 'true' },
    }).then((res) => {
      if (res.ok) {
        setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, activated: true } : u)));
      }
    });
  }, []);

  if (loading && users.length === 0) {
    return <Chargement />;
  }

  return (
    <div className="py-2">
      <title>
        Utilisateurs | Admin | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire
      </title>
      <div className="md:-ml-4 md:flex">
        <FiltersSidebar
          storageKey="admin-users-filters"
          activeFilterCount={
            (urlSearchQuery.trim() ? 1 : 0) +
            selectedRoles.length +
            selectedStatuses.length +
            selectedCfeiStatuses.length +
            selectedOnboardingStatuses.length +
            selectedCfeiValidations.length
          }
          onReset={() => replaceFilters({}, ['tri'])}
        >
          <div className="relative">
            <span
              className="fr-icon--sm fr-icon-search-line absolute top-1/2 left-3 -translate-y-1/2 text-gray-400"
              aria-hidden="true"
            />
            <input
              type="search"
              placeholder="Nom, email, tél, CFEI, id..."
              autoComplete="off"
              data-1p-ignore
              data-lpignore="true"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded border border-gray-300 py-2 pr-3 pl-10 text-sm transition-colors outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <CheckboxFilterSection
            title="Rôle"
            scroll
            options={ROLE_OPTIONS}
            selected={selectedRoles}
            onChange={(next) => setFilters({ roles: next })}
          />
          <CheckboxFilterSection
            title="Statut"
            options={[
              { value: 'activated', label: 'Activés' },
              { value: 'deactivated', label: 'Désactivés' },
              { value: 'blocked', label: 'Bloqués' },
              { value: 'deleted', label: 'Supprimés' },
            ]}
            selected={selectedStatuses}
            onChange={(next) => setFilters({ statut: next })}
          />
          <CheckboxFilterSection
            title="CFEI"
            options={[
              { value: 'with_cfei', label: 'Avec CFEI' },
              { value: 'without_cfei', label: 'Sans CFEI' },
              { value: 'trained', label: 'Formé EI' },
              { value: 'not_trained', label: 'Pas formé EI' },
            ]}
            selected={selectedCfeiStatuses}
            onChange={(next) => setFilters({ cfei: next })}
          />
          <CheckboxFilterSection
            title="Onboarding"
            options={[
              { value: 'completed', label: 'Terminé' },
              { value: 'incomplete', label: 'Incomplet' },
            ]}
            selected={selectedOnboardingStatuses}
            onChange={(next) => setFilters({ onboarding: next })}
          />
          {hasOfficialCfeis && (
            <CheckboxFilterSection
              title="Validation CFEI"
              options={[
                { value: 'valid', label: 'Validé' },
                { value: 'invalid', label: 'Non trouvé' },
                { value: 'missing', label: 'Non renseigné' },
              ]}
              selected={selectedCfeiValidations}
              onChange={(next) => setFilters({ cfei_validation: next })}
            />
          )}
        </FiltersSidebar>
        <div className="min-w-0 flex-1 md:px-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <span className="whitespace-nowrap">Trier par</span>
              <select
                value={sortBy}
                onChange={(e) => setFilters({ tri: e.target.value })}
                className="rounded border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              >
                <option value="name_asc">Nom (A → Z)</option>
                <option value="name_desc">Nom (Z → A)</option>
                <option value="created_desc">Date de création (récent → ancien)</option>
                <option value="created_asc">Date de création (ancien → récent)</option>
                <option value="last_seen_desc">Dernière connexion (récent → ancien)</option>
                <option value="last_seen_asc">Dernière connexion (ancien → récent)</option>
                <option value="carcasses_desc">Nombre de carcasses (plus → moins)</option>
                <option value="fiches_desc">Nombre de fiches (plus → moins)</option>
              </select>
            </label>
            <Button
              size="small"
              linkProps={{ to: '/app/admin/add-user' }}
            >
              + Ajouter des utilisateurs
            </Button>
          </div>
          <AdminViews
            views={USER_VIEWS}
            keep={['tri']}
          />
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-lg font-bold">Utilisateurs ({total})</h3>
            <div className="flex items-center gap-2">
              <button
                className="fr-btn fr-btn--sm fr-btn--secondary"
                disabled={offset === 0}
                onClick={() => setFilters({ page: offset - LIMIT > 0 ? String(offset / LIMIT) : null })}
              >
                Précédent
              </button>
              <span className="text-sm tabular-nums">
                {total ? offset + 1 : 0}–{Math.min(offset + LIMIT, total)} / {total}
              </span>
              <button
                className="fr-btn fr-btn--sm fr-btn--secondary"
                disabled={offset + LIMIT >= total}
                onClick={() => setFilters({ page: String(offset / LIMIT + 2) })}
              >
                Suivant
              </button>
            </div>
          </div>
          <div className="overflow-x-auto bg-white">
            <table className={`w-full border-collapse text-xs ${loading ? 'opacity-60' : ''}`}>
              <thead>
                <tr className="border-b bg-gray-100 text-left">
                  <th className="p-1">Utilisateur</th>
                  <th className="p-1">Rôle</th>
                  <th className="p-1">Statut</th>
                  <th className="p-1">Onboarding</th>
                  <th className="p-1">CFEI</th>
                  <th className="p-1">Commune</th>
                  <th className="p-1 text-right">Fiches</th>
                  <th className="p-1 text-right">Carcasses</th>
                  <th className="p-1">Vu le</th>
                  <th className="p-1">Créé le</th>
                  <th className="p-1">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <UserTableRow
                    key={user.id}
                    user={user}
                    showCfeiValidation={hasOfficialCfeis}
                    onActivate={onActivate}
                  />
                ))}
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
        </div>
      </div>
    </div>
  );
}
