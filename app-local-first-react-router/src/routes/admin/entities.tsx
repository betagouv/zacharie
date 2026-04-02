import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { Select } from '@codegouvfr/react-dsfr/Select';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Badge } from '@codegouvfr/react-dsfr/Badge';
import { EntityTypes } from '@prisma/client';
import dayjs from 'dayjs';
import type { AdminEntitiesResponse } from '@api/src/types/responses';
import Chargement from '@app/components/Chargement';
import API from '@app/services/api';

const entityTypeLabels: Record<EntityTypes, string> = {
  [EntityTypes.PREMIER_DETENTEUR]: 'Premier détenteur',
  [EntityTypes.COLLECTEUR_PRO]: 'Collecteur Pro',
  [EntityTypes.CCG]: 'CCG',
  [EntityTypes.ETG]: 'ETG',
  [EntityTypes.SVI]: 'SVI',
  [EntityTypes.COMMERCE_DE_DETAIL]: 'Commerce de détail',
  [EntityTypes.CANTINE_OU_RESTAURATION_COLLECTIVE]: 'Cantine / Restauration collective',
  [EntityTypes.ASSOCIATION_CARITATIVE]: 'Association caritative',
  [EntityTypes.REPAS_DE_CHASSE_OU_ASSOCIATIF]: 'Repas de chasse / Associatif',
  [EntityTypes.CONSOMMATEUR_FINAL]: 'Consommateur final',
};

export default function AdminEntites() {
  const [entities, setEntities] = useState<AdminEntitiesResponse['data']['entities']>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedCompatible, setSelectedCompatible] = useState('');
  const [selectedTabId, setSelectedTabId] = useState('all');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchEntities = (search: string, type: string, zacharie_compatible: string) => {
    setLoading(true);
    const query: Record<string, string> = {};
    if (search) query.search = search;
    if (type) query.type = type;
    if (zacharie_compatible) query.zacharie_compatible = zacharie_compatible;

    API.get({ path: 'admin/entities', query })
      .then((res) => res as AdminEntitiesResponse)
      .then((res) => {
        if (res.ok) {
          setEntities(res.data.entities);
          setCounts(res.data.counts);
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchEntities('', '', '');
  }, []);

  useEffect(() => {
    fetchEntities(searchQuery, selectedType, selectedCompatible);
  }, [selectedType, selectedCompatible]);

  const onSearchChange = (value: string) => {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchEntities(value, selectedType, selectedCompatible);
    }, 300);
  };

  const filteredEntities = entities.filter((entity) => {
    if (selectedTabId === 'all') return true;
    return entity.type === selectedTabId;
  });

  const pills = [
    { id: 'all', label: 'Tous', count: counts.all ?? 0 },
    ...Object.values(EntityTypes).map((t) => ({
      id: t,
      label: entityTypeLabels[t],
      count: counts[t] ?? 0,
    })),
  ].filter((pill) => pill.id === 'all' || pill.count > 0);

  return (
    <div className="py-2">
      <title>Entités | Admin | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire</title>
      <div className="flex flex-wrap items-end gap-2 pb-2 [&_.fr-input-group]:mb-0 [&_.fr-label]:text-xs [&_.fr-select-group]:mb-0">
        <Input
          className="w-64"
          label="Recherche"
          nativeInputProps={{
            type: 'search',
            value: searchQuery,
            onChange: (e) => onSearchChange(e.target.value),
            placeholder: 'Nom, DDECPP, SIRET, adresse...',
          }}
        />
        <Select
          className="w-48"
          label="Type"
          nativeSelectProps={{
            value: selectedType,
            onChange: (e) => setSelectedType(e.target.value),
          }}
        >
          <option value="">Tous</option>
          {Object.values(EntityTypes).map((t) => (
            <option key={t} value={t}>
              {entityTypeLabels[t]}
            </option>
          ))}
        </Select>
        <Select
          className="w-48"
          label="Compatible Zacharie"
          nativeSelectProps={{
            value: selectedCompatible,
            onChange: (e) => setSelectedCompatible(e.target.value),
          }}
        >
          <option value="">Tous</option>
          <option value="true">Oui</option>
          <option value="false">Non</option>
        </Select>
        <Button
          size="small"
          priority="secondary"
          linkProps={{
            to: '/app/admin/import-ccg',
          }}
        >
          Importer des CCG (CSV/XLS)
        </Button>
        <Button
          size="small"
          linkProps={{
            to: '/app/admin/add-entity',
          }}
        >
          + Ajouter des entités (SVI, ETG, etc.)
        </Button>
      </div>
      <div className="flex flex-wrap gap-1 py-2">
        {pills.map((pill) => (
          <button
            key={pill.id}
            type="button"
            className="rounded-full border px-2 py-0.5 text-xs"
            style={
              selectedTabId === pill.id
                ? {
                    backgroundColor: 'var(--background-active-blue-france)',
                    color: 'var(--text-inverted-blue-france)',
                    borderColor: 'var(--background-active-blue-france)',
                  }
                : {
                    backgroundColor: 'var(--background-contrast-grey)',
                    color: 'var(--text-default-grey)',
                    borderColor: 'var(--border-default-grey)',
                  }
            }
            onClick={() => setSelectedTabId(pill.id)}
          >
            {pill.label} ({pill.count})
          </button>
        ))}
      </div>
      {loading ? (
        <Chargement />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-300 text-xs text-gray-600 uppercase">
                <th className="px-2 py-1">Nom</th>
                <th className="px-2 py-1">N° DDECPP / SIRET</th>
                <th className="px-2 py-1">Adresse</th>
                <th className="px-2 py-1">Type</th>
                <th className="px-2 py-1">Zacharie</th>
                <th className="px-2 py-1">Création</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntities.map((entity, index) => (
                <tr key={entity.id} className="border-b border-gray-200 align-top hover:bg-gray-50">
                  <td className="px-2 py-1">
                    <span className="flex flex-col">
                      <span className="font-medium">
                        <span className="text-xs text-gray-400">{index + 1}. </span>
                        <Link to={`/app/admin/entity/${entity.id}`} className="no-underline">
                          {entity.nom_d_usage}
                        </Link>
                      </span>
                      {entity.raison_sociale && (
                        <span className="text-xs text-gray-500">{entity.raison_sociale}</span>
                      )}
                    </span>
                  </td>
                  <td className="px-2 py-1">
                    <span className="flex flex-col text-xs">
                      {entity.numero_ddecpp && <span>{entity.numero_ddecpp}</span>}
                      {entity.siret && <span className="text-gray-500">{entity.siret}</span>}
                    </span>
                  </td>
                  <td className="px-2 py-1">
                    <span className="flex flex-col text-xs">
                      {entity.address_ligne_1 && <span>{entity.address_ligne_1}</span>}
                      <span>
                        {entity.code_postal} {entity.ville}
                      </span>
                    </span>
                  </td>
                  <td className="px-2 py-1">
                    <Badge severity="info" small>
                      {entityTypeLabels[entity.type] ?? entity.type}
                    </Badge>
                  </td>
                  <td className="px-2 py-1">
                    <Badge severity={entity.zacharie_compatible ? 'success' : 'warning'} small>
                      {entity.zacharie_compatible ? 'Oui' : 'Non'}
                    </Badge>
                  </td>
                  <td className="px-2 py-1">
                    <span className="text-xs text-gray-500" suppressHydrationWarning>
                      {dayjs(entity.created_at).format('DD/MM/YY')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex items-start bg-white px-4 py-2">
        <a className="fr-link fr-icon-arrow-up-fill fr-link--icon-left text-sm" href="#top">
          Haut de page
        </a>
      </div>
    </div>
  );
}
