import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Input } from '@app/components/Input';
import { canonicalOf, normalizeText, type AnomalieItem } from '@app/utils/anomalies-referentiel';
import { track } from '@app/services/matomo';

export type AnomaliePickerSection = {
  groupe: string;
  site: string | null;
  anomalies: AnomalieItem[];
  selected: string[];
  onToggle: (canonical: string) => void;
  champLibre: string | null;
  autres: AnomaliePickerAutres;
};

export type AnomaliePickerAutres = {
  values: string[];
  onAdd: (value: string) => void;
  onRemove: (value: string) => void;
};

const sectionKey = (s: AnomaliePickerSection) => `${s.groupe}|||${s.site ?? ''}`;
const siteLabel = (s: AnomaliePickerSection) => s.site ?? s.groupe;
const sectionCount = (s: AnomaliePickerSection) => s.selected.length + s.autres.values.length;

export default function AnomaliePicker({
  sections,
  autres,
  onBack,
}: {
  sections: AnomaliePickerSection[];
  autres: AnomaliePickerAutres;
  onBack?: () => void;
}) {
  const singleSection = sections.length === 1 ? sections[0] : null;
  const [activeKey, setActiveKey] = useState<string | null>(singleSection ? sectionKey(singleSection) : null);
  const [query, setQuery] = useState('');
  const [zoomItem, setZoomItem] = useState<AnomalieItem | null>(null);
  useEffect(() => {
    track('anomalie', 'ouvrir-selecteur', singleSection ? 'petit-gibier' : 'grand-gibier');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = (section: AnomaliePickerSection, canonical: string, from: 'liste' | 'recherche') => {
    if (section.selected.includes(canonical)) {
      track('anomalie', 'retirer', from);
    } else {
      track('anomalie', 'selectionner', from);
    }
    section.onToggle(canonical);
  };

  const zoom = (item: AnomalieItem) => {
    track('anomalie', 'agrandir-photo');
    setZoomItem(item);
  };

  const addAutreGlobal = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || autres.values.includes(trimmed)) return;
    track('anomalie', 'saisir-libre', 'recherche-vide');
    autres.onAdd(trimmed);
    setQuery('');
  };

  const activeSection = activeKey ? (sections.find((s) => sectionKey(s) === activeKey) ?? null) : null;

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

  const hasSearchResults = searchResults.length > 0;
  useEffect(() => {
    if (!normalizedQuery) return;
    const timer = setTimeout(
      () => track('anomalie', 'rechercher', hasSearchResults ? 'resultat-trouve' : 'resultat-vide'),
      1500
    );
    return () => clearTimeout(timer);
  }, [normalizedQuery, hasSearchResults]);

  const handleBack = useCallback(() => {
    if (query) {
      setQuery('');
      return;
    }
    if (activeKey && !singleSection) {
      setActiveKey(null);
      return;
    }
    onBack?.();
  }, [query, activeKey, singleSection, onBack]);
  const showBack = !!onBack || !!query || (!!activeSection && !singleSection);

  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const dialog = rootRef.current?.closest('dialog.fr-modal');
    if (!dialog) return;
    const intercept = (event: Event) => {
      if (!(event.target as HTMLElement).closest('.fr-btn--close')) return;
      event.preventDefault();
      event.stopPropagation();
      handleBack();
    };
    dialog.addEventListener('click', intercept, true);
    return () => dialog.removeEventListener('click', intercept, true);
  }, [handleBack]);

  return (
    <div
      ref={rootRef}
      className="flex min-h-64 flex-col gap-3"
    >
      <div className="flex shrink-0 items-center gap-2">
        {showBack && (
          <Button
            type="button"
            priority="tertiary no outline"
            iconId="fr-icon-arrow-left-line"
            title="Retour"
            onClick={handleBack}
          />
        )}
        <Input
          label=""
          className="mb-0! grow"
          nativeInputProps={{
            type: 'search',
            value: query,
            placeholder: 'Rechercher une anomalie…',
            onChange: (e) => setQuery(e.target.value),
            onKeyDown: (e) => {
              if (e.key === 'Enter') e.preventDefault();
            },
          }}
        />
      </div>
      {activeSection && !query && (
        <span className="shrink-0 text-xs text-gray-500">
          {[activeSection.groupe, activeSection.site].filter(Boolean).join(' › ')}
        </span>
      )}

      <div>
        {normalizedQuery.length > 0 ? (
          <div className="flex flex-col gap-2">
            {searchResults.length === 0 ? (
              <div className="flex flex-col items-start gap-2">
                <p className="mb-0 text-sm text-gray-600">Aucune anomalie ne correspond à votre recherche.</p>
                <Button
                  type="button"
                  priority="secondary"
                  iconId="fr-icon-add-line"
                  onClick={() => addAutreGlobal(query)}
                >
                  Ajouter «&nbsp;{query.trim()}&nbsp;» comme anomalie
                </Button>
              </div>
            ) : (
              searchResults.map(({ section, item, canonical }) => (
                <AnomalieItemRow
                  key={`${sectionKey(section)}-${canonical}`}
                  item={item}
                  context={!activeSection ? siteLabel(section) : undefined}
                  isSelected={section.selected.includes(canonical)}
                  onToggle={() => toggle(section, canonical, 'recherche')}
                  onZoom={() => zoom(item)}
                />
              ))
            )}
          </div>
        ) : !activeSection ? (
          <div className="flex flex-col gap-3">
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
                      {sectionCount(section) > 0 && (
                        <span className="rounded-full bg-[#000091] px-2 py-0.5 text-xs font-bold text-white">
                          {sectionCount(section)}
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
          <div className="flex flex-col gap-4">
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
                      onClick={() => {
                        track('anomalie', 'retirer', 'pastille');
                        activeSection.onToggle(canonical);
                      }}
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
                    onToggle={() => toggle(activeSection, canonical, 'liste')}
                    onZoom={() => zoom(item)}
                  />
                );
              })}
            </div>

            {activeSection.champLibre && (
              <AutreAnomalieBlock
                title="Autre anomalie"
                placeholder={activeSection.champLibre}
                autres={activeSection.autres}
                trackingName="famille"
              />
            )}
          </div>
        )}
      </div>

      {!normalizedQuery && !activeSection && (
        <AutreAnomalieBlock
          title="Autre anomalie (non listée)"
          placeholder="Décrivez l’anomalie"
          autres={autres}
          trackingName="hors-famille"
        />
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

function AutreAnomalieBlock({
  title,
  placeholder,
  autres,
  trackingName,
}: {
  title: string;
  placeholder: string;
  autres: AnomaliePickerAutres;
  trackingName: 'famille' | 'hors-famille';
}) {
  const [draft, setDraft] = useState('');

  const add = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    setDraft('');
    if (autres.values.includes(trimmed)) return;
    track('anomalie', 'saisir-libre', trackingName);
    autres.onAdd(trimmed);
  };

  return (
    <div className="flex flex-col gap-2 border-t border-gray-200 pt-3">
      <p className="mb-0 text-xs font-bold tracking-wide text-gray-500 uppercase">{title}</p>
      {autres.values.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {autres.values.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                track('anomalie', 'retirer', 'saisie-libre');
                autres.onRemove(value);
              }}
              className="flex items-center gap-1 rounded-full bg-[#000091] px-3 py-1 text-left text-sm text-white"
              aria-label={`Retirer ${value}`}
            >
              <span>{value}</span>
              <span
                className="fr-icon-close-line fr-icon--sm"
                aria-hidden
              />
            </button>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <Input
          label=""
          className="mb-0! grow"
          nativeInputProps={{
            type: 'text',
            value: draft,
            placeholder,
            onChange: (e) => setDraft(e.target.value),
            onBlur: () => add(),
            onKeyDown: (e) => {
              if (e.key !== 'Enter') return;
              e.preventDefault();
              add();
            },
          }}
        />
        <Button
          type="button"
          priority="secondary"
          disabled={!draft.trim()}
          onClick={add}
        >
          Ajouter
        </Button>
      </div>
    </div>
  );
}

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
        className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden bg-gray-100 text-gray-400 transition-colors hover:bg-gray-200"
      >
        {item.photos.length > 0 ? (
          <>
            <img
              src={`/anomalies/${item.photos[0]}`}
              alt={item.intitule}
              loading="lazy"
              className="size-full object-cover"
            />
            <span
              className="fr-icon-zoom-in-line fr-icon--sm absolute right-0.5 bottom-0.5 rounded-full bg-white/80 text-gray-700"
              aria-hidden
            />
          </>
        ) : (
          <span
            className="fr-icon-image-line"
            aria-hidden
          />
        )}
      </button>
      <button
        type="button"
        aria-pressed={isSelected}
        onClick={onToggle}
        className="flex flex-1 items-center justify-between gap-3 px-3 py-2 text-left text-sm text-gray-900"
      >
        <span className="flex flex-col">
          <span className="font-medium">{item.intitule}</span>
          {context && <span className="text-xs text-gray-500">{context}</span>}
        </span>
        <span
          className={[
            'shrink-0',
            isSelected ? 'fr-icon-checkbox-fill text-[#000091]' : 'fr-icon-checkbox-line text-gray-400',
          ].join(' ')}
          aria-hidden
        />
      </button>
    </div>
  );
}

function PhotoOverlay({ item, onClose }: { item: AnomalieItem; onClose: () => void }) {
  const photos = item.photos;
  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => setIndex(0), [item]);

  const go = useCallback(
    (delta: number) => setIndex((i) => (i + delta + photos.length) % photos.length),
    [photos.length]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (photos.length > 1 && e.key === 'ArrowLeft') go(-1);
      if (photos.length > 1 && e.key === 'ArrowRight') go(1);
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, go, photos.length]);

  return createPortal(
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
        className="flex h-full w-full max-w-lg flex-col items-center gap-3 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {photos.length > 0 ? (
          <div className="flex h-[55vh] w-full shrink-0 items-center gap-2">
            {photos.length > 1 && (
              <button
                type="button"
                onClick={() => go(-1)}
                aria-label="Photo précédente"
                className="fr-icon-arrow-left-s-line flex size-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
              />
            )}
            <div
              className="flex h-full min-w-0 flex-1 items-center justify-center"
              onTouchStart={(e) => {
                touchStartX.current = e.touches[0].clientX;
              }}
              onTouchEnd={(e) => {
                if (touchStartX.current === null || photos.length < 2) return;
                const delta = e.changedTouches[0].clientX - touchStartX.current;
                touchStartX.current = null;
                if (Math.abs(delta) > 40) go(delta < 0 ? 1 : -1);
              }}
            >
              <img
                src={`/anomalies/${photos[index]}`}
                alt={`${item.intitule}${photos.length > 1 ? ` (photo ${index + 1} sur ${photos.length})` : ''}`}
                className="max-h-full max-w-full rounded-lg object-contain"
              />
            </div>
            {photos.length > 1 && (
              <button
                type="button"
                onClick={() => go(1)}
                aria-label="Photo suivante"
                className="fr-icon-arrow-right-s-line flex size-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
              />
            )}
          </div>
        ) : (
          <div className="flex h-[55vh] w-full shrink-0 flex-col items-center justify-center gap-2 rounded-lg bg-gray-800 text-gray-400">
            <span
              className="fr-icon-image-line fr-icon--lg"
              aria-hidden
            />
            <span className="px-4 text-center text-sm">Pas de photo disponible</span>
          </div>
        )}

        {photos.length > 1 && (
          <div className="flex shrink-0 items-center gap-3 text-white">
            <span className="text-sm text-white/80">
              {index + 1} / {photos.length}
            </span>
            <span className="flex items-center gap-2">
              {photos.map((photo, i) => (
                <button
                  key={photo}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`Photo ${i + 1}`}
                  aria-current={i === index}
                  className={['size-2.5 rounded-full', i === index ? 'bg-white' : 'bg-white/30'].join(' ')}
                />
              ))}
            </span>
          </div>
        )}

        <figcaption className="min-h-0 flex-1 overflow-y-auto text-center text-white">
          <span className="block font-bold">{item.intitule}</span>
          {item.infobulle && <span className="mt-1 block text-sm text-white/80">{item.infobulle}</span>}
        </figcaption>
      </figure>
    </div>,
    document.body
  );
}
