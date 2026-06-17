import { useMemo, useState } from 'react';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Input } from '@codegouvfr/react-dsfr/Input';
import type { TreeNode } from '@app/components/ModalTreeDisplay';
import {
  collectCanonicals,
  flattenReferentielTree,
  getNodeAtPath,
  isChampLibre,
  isLeafGroup,
  joinCanonical,
  normalizeText,
} from '@app/utils/anomalies-referentiel';

export type AnomalieNavSection = {
  // Clé technique unique (ex. 'carcasse', 'abats')
  key: string;
  // Libellé affiché du bouton de section (ex. 'Carcasse', 'Abats')
  label: string;
  tree: TreeNode | string[];
  selected: string[];
  onToggle: (canonical: string) => void;
  onAddFreeText: (value: string) => void;
};

// Libellé court d'une anomalie (feuille, avant le premier " - ").
function shortLabel(canonical: string): string {
  return canonical.split(' - ')[0];
}

// Contexte d'une anomalie (catégories parentes), pour l'affichage en recherche.
function pathHint(canonical: string): string {
  return canonical.split(' - ').slice(1).join(' › ');
}

export default function AnomaliesTreeNavigator({ sections }: { sections: AnomalieNavSection[] }) {
  const hasMultipleSections = sections.length > 1;
  // path[0] = clé de section, path[1..] = clés de l'arbre.
  const [path, setPath] = useState<string[]>(hasMultipleSections ? [] : [sections[0].key]);
  const [query, setQuery] = useState('');
  const [freeText, setFreeText] = useState('');

  const activeSection = path.length ? (sections.find((s) => s.key === path[0]) ?? null) : null;
  const treeKeys = path.slice(1);
  const currentNode = useMemo(
    () => (activeSection ? getNodeAtPath(activeSection.tree, treeKeys) : null),
    [activeSection, treeKeys]
  );

  // Index plat de toutes les feuilles de toutes les sections, pour la recherche.
  const searchIndex = useMemo(
    () =>
      sections.flatMap((section) =>
        flattenReferentielTree(section.tree).flatMap((group) =>
          group.items.map((item) => ({ section, canonical: item.canonical, leaf: item.leaf }))
        )
      ),
    [sections]
  );

  const normalizedQuery = normalizeText(query.trim());
  const searchResults =
    normalizedQuery.length > 0
      ? searchIndex.filter((entry) => normalizeText(entry.canonical).includes(normalizedQuery))
      : [];

  // Section cible de la saisie libre (la section active, ou l'unique section).
  const freeTextSection = activeSection ?? (sections.length === 1 ? sections[0] : null);

  const goBack = () => setPath((p) => p.slice(0, -1));

  const addFreeText = () => {
    const value = freeText.trim();
    if (!freeTextSection || !value || freeTextSection.selected.includes(value)) {
      setFreeText('');
      return;
    }
    freeTextSection.onAddFreeText(value);
    setFreeText('');
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Barre de recherche */}
      <Input
        label=""
        className="mb-0!"
        nativeInputProps={{
          type: 'search',
          value: query,
          placeholder: 'Rechercher une anomalie…',
          onChange: (e) => setQuery(e.target.value),
          // Évite la soumission du <form> parent (la modale de création est rendue dans un form).
          onKeyDown: (e) => {
            if (e.key === 'Enter') e.preventDefault();
          },
        }}
      />

      {normalizedQuery.length > 0 ? (
        /* --- Résultats de recherche (toutes catégories) --- */
        <div className="flex flex-col gap-2">
          {searchResults.length === 0 ? (
            <p className="mb-0 text-sm text-gray-600">Aucune anomalie ne correspond à votre recherche.</p>
          ) : (
            searchResults.map((entry) => (
              <LeafButton
                key={`${entry.section.key}-${entry.canonical}`}
                label={entry.leaf}
                hint={[hasMultipleSections ? entry.section.label : '', pathHint(entry.canonical)]
                  .filter(Boolean)
                  .join(' · ')}
                isSelected={entry.section.selected.includes(entry.canonical)}
                onClick={() => entry.section.onToggle(entry.canonical)}
              />
            ))
          )}
        </div>
      ) : !activeSection ? (
        /* --- Vue 1 : choix de la section (carcasse / abats) --- */
        <div className="flex flex-col gap-2">
          <p className="mb-0 text-sm text-gray-600">Que souhaitez-vous renseigner&nbsp;?</p>
          {sections.map((section) => (
            <button
              key={section.key}
              type="button"
              onClick={() => setPath([section.key])}
              className="flex w-full items-center justify-between gap-3 rounded-md border border-[#000091] bg-[#E8EDFF] px-4 py-3 text-left font-semibold text-[#000091]"
            >
              <span>{section.label}</span>
              <span className="flex items-center gap-2">
                {section.selected.length > 0 && (
                  <span className="rounded-full bg-[#000091] px-2 py-0.5 text-xs text-white">
                    {section.selected.length}
                  </span>
                )}
                <span
                  className="fr-icon-arrow-right-s-line"
                  aria-hidden
                />
              </span>
            </button>
          ))}
        </div>
      ) : (
        /* --- Vue drill-down --- */
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              priority="tertiary no outline"
              iconId="fr-icon-arrow-left-line"
              onClick={goBack}
            >
              Retour
            </Button>
            <span className="text-sm text-gray-600">{[activeSection.label, ...treeKeys].join(' › ')}</span>
          </div>

          {activeSection.selected.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {activeSection.selected.map((canonical) => (
                <button
                  key={canonical}
                  type="button"
                  onClick={() => activeSection.onToggle(canonical)}
                  className="flex items-center gap-1 rounded-full bg-[#000091] px-3 py-1 text-left text-sm text-white"
                  aria-label={`Retirer ${shortLabel(canonical)}`}
                >
                  <span>{shortLabel(canonical)}</span>
                  <span
                    className="fr-icon-close-line fr-icon--sm"
                    aria-hidden
                  />
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2">
            {Array.isArray(currentNode)
              ? currentNode.map((leaf) => {
                  const canonical = joinCanonical([...treeKeys, leaf]);
                  return (
                    <LeafButton
                      key={canonical}
                      label={leaf}
                      isSelected={activeSection.selected.includes(canonical)}
                      onClick={() => activeSection.onToggle(canonical)}
                    />
                  );
                })
              : Object.entries(currentNode as TreeNode).map(([key, value]) => {
                  if (isChampLibre(key)) return null;
                  if (isLeafGroup(value)) {
                    const canonical = joinCanonical([...treeKeys, key]);
                    return (
                      <LeafButton
                        key={key}
                        label={key}
                        isSelected={activeSection.selected.includes(canonical)}
                        onClick={() => activeSection.onToggle(canonical)}
                      />
                    );
                  }
                  const childCanonicals = collectCanonicals(value, [...treeKeys, key]);
                  const selectedCount = childCanonicals.filter((c) =>
                    activeSection.selected.includes(c)
                  ).length;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setPath([...path, key])}
                      className="flex w-full items-center justify-between gap-3 rounded-md border border-gray-200 bg-white px-4 py-3 text-left font-semibold"
                    >
                      <span>{key}</span>
                      <span className="flex items-center gap-2">
                        {selectedCount > 0 && (
                          <span className="rounded-full bg-[#000091] px-2 py-0.5 text-xs text-white">
                            {selectedCount}
                          </span>
                        )}
                        <span
                          className="fr-icon-arrow-right-s-line"
                          aria-hidden
                        />
                      </span>
                    </button>
                  );
                })}
          </div>
        </div>
      )}

      {/* Saisie libre */}
      {freeTextSection && (
        <div className="flex items-end gap-2">
          <Input
            label="Autre (saisie libre)"
            className="mb-0! grow"
            nativeInputProps={{
              type: 'text',
              value: freeText,
              placeholder: 'Décrire une autre anomalie',
              onChange: (e) => setFreeText(e.target.value),
              onKeyDown: (e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addFreeText();
                }
              },
            }}
          />
          <Button
            type="button"
            priority="secondary"
            disabled={!freeText.trim()}
            onClick={addFreeText}
          >
            Ajouter
          </Button>
        </div>
      )}
    </div>
  );
}

function LeafButton({
  label,
  hint,
  isSelected,
  onClick,
}: {
  label: string;
  hint?: string;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={isSelected}
      onClick={onClick}
      className={[
        'flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors',
        isSelected
          ? 'border-[#000091] bg-[#000091] text-white'
          : 'border-[#E8EDFF] bg-[#E8EDFF] text-[#000091]',
      ].join(' ')}
    >
      {/* Emplacement photo (à venir) */}
      <span className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded bg-gray-200">
        <span
          className="fr-icon-image-line text-gray-400"
          aria-hidden
        />
        <span
          className="fr-icon-zoom-in-line fr-icon--sm absolute right-0 bottom-0 text-gray-400"
          aria-label="Agrandir la photo (à venir)"
        />
      </span>
      <span className="flex flex-1 flex-col">
        <span>{label}</span>
        {hint && (
          <span className={['text-xs', isSelected ? 'text-white/80' : 'text-[#000091]/70'].join(' ')}>
            {hint}
          </span>
        )}
      </span>
      {isSelected && (
        <span
          className="fr-icon-check-line fr-icon--sm shrink-0"
          aria-hidden
        />
      )}
    </button>
  );
}
