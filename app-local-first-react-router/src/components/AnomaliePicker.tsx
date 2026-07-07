import { useEffect, useMemo, useState } from 'react';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { canonicalOf, normalizeText, type AnomalieItem } from '@app/utils/anomalies-referentiel';

// Une section = un site anatomique (groupe + site), avec ses anomalies,
// les canonicals déjà sélectionnés et le toggle branché sur le store / state local.
export type AnomaliePickerSection = {
  groupe: string;
  site: string | null;
  anomalies: AnomalieItem[];
  selected: string[];
  onToggle: (canonical: string) => void;
};

const sectionKey = (s: AnomaliePickerSection) => `${s.groupe}|||${s.site ?? ''}`;
const siteLabel = (s: AnomaliePickerSection) => s.site ?? s.groupe;

export default function AnomaliePicker({ sections }: { sections: AnomaliePickerSection[] }) {
  // Si une seule section (ex. petit gibier), on va directement à la liste des anomalies.
  const singleSection = sections.length === 1 ? sections[0] : null;
  const [activeKey, setActiveKey] = useState<string | null>(singleSection ? sectionKey(singleSection) : null);
  const [query, setQuery] = useState('');
  // Anomalie dont on affiche la photo en grand (avec sa description en légende).
  const [zoomItem, setZoomItem] = useState<AnomalieItem | null>(null);

  const activeSection = activeKey ? (sections.find((s) => sectionKey(s) === activeKey) ?? null) : null;

  // Regroupe les sections par groupe pour les en-têtes de la vue 1.
  const groups = useMemo(() => {
    const map = new Map<string, AnomaliePickerSection[]>();
    for (const section of sections) {
      const list = map.get(section.groupe) ?? [];
      list.push(section);
      map.set(section.groupe, list);
    }
    return Array.from(map.entries());
  }, [sections]);

  const normalizedQuery = normalizeText(query.trim());

  // Recherche : globale en vue 1, restreinte à la section active en vue 2.
  const searchResults = useMemo(() => {
    if (!normalizedQuery) return [];
    const scope = activeSection ? [activeSection] : sections;
    const results: Array<{ section: AnomaliePickerSection; item: AnomalieItem; canonical: string }> = [];
    for (const section of scope) {
      for (const item of section.anomalies) {
        const haystack = normalizeText(`${item.intitule} ${item.infobulle ?? ''}`);
        if (haystack.includes(normalizedQuery)) {
          results.push({ section, item, canonical: canonicalOf(item.intitule, section.site) });
        }
      }
    }
    return results;
  }, [normalizedQuery, activeSection, sections]);

  const goBack = () => {
    setQuery('');
    setActiveKey(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <Input
        label=""
        className="mb-0!"
        nativeInputProps={{
          type: 'search',
          value: query,
          placeholder: 'Rechercher une anomalie…',
          onChange: (e) => setQuery(e.target.value),
          // Évite la soumission du <form> parent (rendu dans un form de création).
          onKeyDown: (e) => {
            if (e.key === 'Enter') e.preventDefault();
          },
        }}
      />

      {normalizedQuery.length > 0 ? (
        /* --- Résultats de recherche --- */
        <div className="flex flex-col gap-2">
          {searchResults.length === 0 ? (
            <p className="mb-0 text-sm text-gray-600">Aucune anomalie ne correspond à votre recherche.</p>
          ) : (
            searchResults.map(({ section, item, canonical }) => (
              <AnomalieItemRow
                key={`${sectionKey(section)}-${canonical}`}
                item={item}
                context={!activeSection ? siteLabel(section) : undefined}
                isSelected={section.selected.includes(canonical)}
                onToggle={() => section.onToggle(canonical)}
                onZoom={() => setZoomItem(item)}
              />
            ))
          )}
        </div>
      ) : !activeSection ? (
        /* --- Vue 1 : choix du site anatomique, groupé --- */
        <div className="flex flex-col gap-4">
          <p className="mb-0 text-sm text-gray-600">Sur quelle partie souhaitez-vous renseigner&nbsp;?</p>
          {groups.map(([groupe, groupSections]) => (
            <div
              key={groupe}
              className="flex flex-col gap-2"
            >
              <p className="mb-0 text-xs font-bold tracking-wide text-gray-500 uppercase">{groupe}</p>
              {groupSections.map((section) => (
                <button
                  key={sectionKey(section)}
                  type="button"
                  onClick={() => setActiveKey(sectionKey(section))}
                  className="flex w-full items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 text-left font-medium text-gray-900 transition-colors hover:border-[#000091] hover:bg-[#f5f5fe]"
                >
                  <span>{siteLabel(section)}</span>
                  <span className="flex items-center gap-2">
                    {section.selected.length > 0 && (
                      <span className="rounded-full bg-[#000091] px-2 py-0.5 text-xs font-bold text-white">
                        {section.selected.length}
                      </span>
                    )}
                    <span
                      className="fr-icon-arrow-right-s-line text-gray-400"
                      aria-hidden
                    />
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      ) : (
        /* --- Vue 2 : anomalies du site sélectionné --- */
        <div className="flex flex-col gap-4">
          {!singleSection && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                priority="tertiary no outline"
                iconId="fr-icon-arrow-left-line"
                onClick={goBack}
              >
                Retour
              </Button>
              <span className="text-sm text-gray-600">
                {[activeSection.groupe, activeSection.site].filter(Boolean).join(' › ')}
              </span>
            </div>
          )}

          {activeSection.selected.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {activeSection.selected.map((canonical) => {
                const item = activeSection.anomalies.find(
                  (a) => canonicalOf(a.intitule, activeSection.site) === canonical
                );
                const label = item?.intitule ?? canonical;
                return (
                  <button
                    key={canonical}
                    type="button"
                    onClick={() => activeSection.onToggle(canonical)}
                    className="flex items-center gap-1 rounded-full bg-[#000091] px-3 py-1 text-left text-sm text-white"
                    aria-label={`Retirer ${label}`}
                  >
                    <span>{label}</span>
                    <span
                      className="fr-icon-close-line fr-icon--sm"
                      aria-hidden
                    />
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex flex-col gap-2">
            {activeSection.anomalies.map((item) => {
              const canonical = canonicalOf(item.intitule, activeSection.site);
              return (
                <AnomalieItemRow
                  key={canonical}
                  item={item}
                  isSelected={activeSection.selected.includes(canonical)}
                  onToggle={() => activeSection.onToggle(canonical)}
                  onZoom={() => setZoomItem(item)}
                />
              );
            })}
          </div>
        </div>
      )}

      {zoomItem && (
        <PhotoOverlay
          item={zoomItem}
          onClose={() => setZoomItem(null)}
        />
      )}
    </div>
  );
}

// Ligne d'anomalie : vignette photo (clic = agrandir) + intitulé (clic = sélectionner).
// Deux boutons distincts côte à côte (pas de bouton imbriqué).
function AnomalieItemRow({
  item,
  context,
  isSelected,
  onToggle,
  onZoom,
}: {
  item: AnomalieItem;
  context?: string;
  isSelected: boolean;
  onToggle: () => void;
  onZoom: () => void;
}) {
  return (
    <div
      className={[
        'flex items-stretch overflow-hidden rounded-lg border transition-colors',
        isSelected ? 'border-[#000091] bg-[#f5f5fe]' : 'border-gray-200 bg-white hover:border-gray-300',
      ].join(' ')}
    >
      <button
        type="button"
        onClick={onZoom}
        aria-label={`Agrandir la photo de « ${item.intitule} »`}
        className="relative flex size-14 shrink-0 items-center justify-center bg-gray-100 text-gray-400 transition-colors hover:bg-gray-200"
      >
        <span
          className="fr-icon-image-line"
          aria-hidden
        />
        <span
          className="fr-icon-zoom-in-line fr-icon--sm absolute right-0.5 bottom-0.5 text-gray-500"
          aria-hidden
        />
      </button>
      <button
        type="button"
        aria-pressed={isSelected}
        onClick={onToggle}
        className="flex flex-1 items-center justify-between gap-2 px-3 py-2 text-left text-sm text-gray-900"
      >
        <span className="flex flex-col">
          <span className="font-medium">{item.intitule}</span>
          {context && <span className="text-xs text-gray-500">{context}</span>}
        </span>
        <span
          className={[
            'fr-icon-check-line fr-icon--sm shrink-0',
            isSelected ? 'text-[#000091]' : 'text-transparent',
          ].join(' ')}
          aria-hidden
        />
      </button>
    </div>
  );
}

// Superposition plein écran : photo agrandie + description en légende.
function PhotoOverlay({ item, onClose }: { item: AnomalieItem; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/90 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Photo : ${item.intitule}`}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Fermer"
        className="fr-icon-close-line absolute top-4 right-4 flex size-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
      />
      <figure
        className="flex max-h-full w-full max-w-lg flex-col items-center gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Emplacement photo (assets à venir) */}
        <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-lg bg-gray-800 text-gray-400">
          <span
            className="fr-icon-image-line fr-icon--lg"
            aria-hidden
          />
          <span className="px-4 text-center text-sm">{item.photo ?? 'Photo à venir'}</span>
        </div>
        <figcaption className="text-center text-white">
          <span className="block font-bold">{item.intitule}</span>
          {item.infobulle && <span className="mt-1 block text-sm text-white/80">{item.infobulle}</span>}
        </figcaption>
        <Button
          type="button"
          priority="secondary"
          className="bg-white!"
          onClick={onClose}
        >
          Fermer
        </Button>
      </figure>
    </div>
  );
}
