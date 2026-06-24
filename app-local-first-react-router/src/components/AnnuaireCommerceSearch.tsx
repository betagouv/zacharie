import { useEffect, useState } from 'react';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import { EntityRelationType, EntityRelationStatus } from '@prisma/client';
import type { AnnuaireResult, AnnuaireSearchResponse, UserEntityResponse } from '@api/src/types/responses';
import API from '@app/services/api';
import useZustandStore from '@app/zustand/store';
import { toast } from 'react-toastify';

interface AnnuaireCommerceSearchProps {
  // Repli vers la saisie manuelle quand le commerce n'est pas dans l'annuaire ou hors-ligne.
  onManualEntry: () => void;
  onFinish: (entity: UserEntityResponse['data']['entity']) => void;
}

export default function AnnuaireCommerceSearch({ onManualEntry, onFinish }: AnnuaireCommerceSearchProps) {
  const entities = useZustandStore((state) => state.entities);
  const [query, setQuery] = useState('');
  const [codePostal, setCodePostal] = useState('');
  const [results, setResults] = useState<Array<AnnuaireResult>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setResults([]);
      setSearchError(null);
      return;
    }
    let cancelled = false;
    setIsSearching(true);
    const timeout = setTimeout(() => {
      API.get({
        path: 'entite/annuaire/search',
        query: { q, ...(codePostal.trim() ? { code_postal: codePostal.trim() } : {}) },
      })
        .then((res) => res as AnnuaireSearchResponse)
        .then((res) => {
          if (cancelled) return;
          if (res.ok) {
            setResults(res.data.results);
            setSearchError(null);
          } else {
            setResults([]);
            setSearchError(res.error || 'La recherche dans l’annuaire a échoué');
          }
        })
        .finally(() => {
          if (!cancelled) setIsSearching(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [query, codePostal]);

  const handleSelect = async (annuaireResult: AnnuaireResult) => {
    setIsSelecting(true);
    const response = await API.post({
      path: 'entite/annuaire/select',
      body: {
        siret: annuaireResult.siret,
        siren: annuaireResult.siren,
        raison_sociale: annuaireResult.raison_sociale,
        address_ligne_1: annuaireResult.address_ligne_1,
        code_postal: annuaireResult.code_postal,
        ville: annuaireResult.ville,
      },
    })
      .then((data) => data as UserEntityResponse)
      .finally(() => setIsSelecting(false));

    if (response.ok && response.data.entity) {
      useZustandStore.setState({
        entities: {
          ...entities,
          [response.data.entity.id]: {
            ...response.data.entity,
            relation: EntityRelationType.CAN_TRANSMIT_CARCASSES_TO_ENTITY,
            relationStatus: EntityRelationStatus.MEMBER,
          },
        },
      });
      onFinish(response.data.entity);
    } else {
      toast.error(response.error || 'Une erreur est survenue lors de la sélection du commerce');
    }
  };

  return (
    <div className="space-y-4">
      <Alert
        small
        severity="info"
        className="mb-4 bg-white"
        description="Recherchez le commerce de détail dans l’annuaire officiel des entreprises pour éviter les doublons. S’il n’apparaît pas, vous pouvez le saisir manuellement."
      />
      <Input
        label="Nom du commerce *"
        hintText="Au moins 3 caractères (ex. : boucherie Martin)"
        nativeInputProps={{
          value: query,
          autoComplete: 'off',
          onChange: (e) => setQuery(e.currentTarget.value),
        }}
      />
      <Input
        label="Code postal (optionnel)"
        hintText="Affine la recherche"
        nativeInputProps={{
          value: codePostal,
          autoComplete: 'off',
          inputMode: 'numeric',
          onChange: (e) => setCodePostal(e.currentTarget.value),
        }}
      />

      {isSearching && <p className="text-sm text-gray-600">Recherche en cours…</p>}

      {searchError && (
        <Alert
          small
          severity="warning"
          description={
            <span>
              {searchError}. Vous pouvez{' '}
              <button
                type="button"
                className="fr-link"
                onClick={onManualEntry}
              >
                saisir le commerce manuellement
              </button>
              .
            </span>
          }
        />
      )}

      {!isSearching && !searchError && query.trim().length >= 3 && results.length === 0 && (
        <Alert
          small
          severity="info"
          description={
            <span>
              Aucun commerce trouvé. Vous pouvez{' '}
              <button
                type="button"
                className="fr-link"
                onClick={onManualEntry}
              >
                le saisir manuellement
              </button>
              .
            </span>
          }
        />
      )}

      {results.length > 0 && (
        <ul className="m-0 list-none space-y-2 p-0">
          {results.map((annuaireResult) => (
            <li key={annuaireResult.siret}>
              <button
                type="button"
                disabled={isSelecting}
                onClick={() => handleSelect(annuaireResult)}
                className="flex w-full flex-col items-start rounded border border-solid border-gray-300 bg-white px-3 py-2 text-left hover:bg-blue-50 disabled:opacity-50"
              >
                <span className="font-bold">{annuaireResult.raison_sociale}</span>
                <span className="text-sm text-gray-600">
                  {annuaireResult.address_ligne_1}
                  {annuaireResult.address_ligne_1 ? ', ' : ''}
                  {annuaireResult.code_postal} {annuaireResult.ville}
                </span>
                <span className="text-xs text-gray-500">SIRET {annuaireResult.siret}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Button
        type="button"
        priority="secondary"
        onClick={onManualEntry}
      >
        Le commerce n’est pas dans l’annuaire
      </Button>
    </div>
  );
}
