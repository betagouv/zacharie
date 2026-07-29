import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  // Libellé de la saisie libre proposée par la famille, null si elle n'en propose pas.
  champLibre: string | null;
  // Saisies libres déjà faites dans cette famille.
  autres: AnomaliePickerAutres;
};

// Anomalies saisies en texte libre, hors référentiel.
export type AnomaliePickerAutres = {
  values: string[];
  onAdd: (value: string) => void;
  onRemove: (value: string) => void;
};

const sectionKey = (s: AnomaliePickerSection) => `${s.groupe}|||${s.site ?? ''}`;
const siteLabel = (s: AnomaliePickerSection) => s.site ?? s.groupe;
// La saisie libre de la famille compte comme une anomalie de la famille : c'est ce que comptent
// les compteurs en aval (carte, bouton « Anomalies (N) », modale de confirmation).
const sectionCount = (s: AnomaliePickerSection) => s.selected.length + s.autres.values.length;

export default function AnomaliePicker({
  sections,
  autres,
  onBack,
}: {
  sections: AnomaliePickerSection[];
  autres: AnomaliePickerAutres;
  // Appelé quand il n'y a plus de niveau interne à remonter (sortie du picker).
  onBack?: () => void;
}) {
  // Si une seule section (ex. petit gibier), on va directement à la liste des anomalies.
  const singleSection = sections.length === 1 ? sections[0] : null;
  const [activeKey, setActiveKey] = useState<string | null>(singleSection ? sectionKey(singleSection) : null);
  const [query, setQuery] = useState('');
  // Anomalie dont on affiche la photo en grand (avec sa description en légende).
  const [zoomItem, setZoomItem] = useState<AnomalieItem | null>(null);
  // Ajout hors famille, depuis une recherche infructueuse.
  const addAutreGlobal = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || autres.values.includes(trimmed)) return;
    autres.onAdd(trimmed);
    // On sort de la recherche : la nouvelle anomalie est visible dans la vue racine.
    setQuery('');
  };

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

  // Retour contextuel : remonte d'un niveau à la fois
  // (recherche → famille → liste des sites → sortie du picker via onBack).
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

  // Quand le picker est rendu dans une modale DSFR, le « Fermer » de l'en-tête remonte d'un niveau
  // au lieu de fermer la modale : on perdrait la carcasse en cours de saisie. On intercepte le clic
  // en phase capture sur le dialog, avant qu'il n'atteigne le bouton et son handler DSFR.
  // Une fois sorti du picker, le bouton retrouve son comportement normal.
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
    // Un plancher de hauteur, pour que la modale hôte ne saute pas d'une vue à l'autre. Pas de plafond :
    // le corps de la modale DSFR est déjà un conteneur de scroll, en ajouter un ici donnerait deux
    // barres de défilement imbriquées.
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
            // Évite la soumission du <form> parent (rendu dans un form de création).
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
          /* --- Résultats de recherche --- */
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
                  onToggle={() => section.onToggle(canonical)}
                  onZoom={() => setZoomItem(item)}
                />
              ))
            )}
          </div>
        ) : !activeSection ? (
          /* --- Vue 1 : choix du site anatomique, groupé --- */
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
          /* --- Vue 2 : anomalies du site sélectionné --- */
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

            {activeSection.champLibre && (
              <AutreAnomalieBlock
                title="Autre anomalie"
                placeholder={activeSection.champLibre}
                autres={activeSection.autres}
              />
            )}
          </div>
        )}
      </div>

      {/* Liste des sites : saisie libre pour ce qui ne relève d'aucune famille. En petit gibier,
          cette vue n'existe pas — la famille unique porte déjà son propre champ libre. */}
      {!normalizedQuery && !activeSection && (
        <AutreAnomalieBlock
          title="Autre anomalie (non listée)"
          placeholder="Décrivez l’anomalie"
          autres={autres}
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

// Saisie d'une anomalie absente du référentiel, avec les valeurs déjà saisies en pastilles.
// Utilisé pour la saisie libre d'une famille comme pour celle, hors famille, de la vue racine.
function AutreAnomalieBlock({
  title,
  placeholder,
  autres,
}: {
  title: string;
  placeholder: string;
  autres: AnomaliePickerAutres;
}) {
  const [draft, setDraft] = useState('');

  const add = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    setDraft('');
    if (autres.values.includes(trimmed)) return;
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
              onClick={() => autres.onRemove(value)}
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
            // Évite la soumission du <form> parent (rendu dans un form de création).
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
        {/* Rond vide / rond plein : c'est lui qui signale qu'on peut sélectionner. */}
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

// Superposition plein écran : photo agrandie (carrousel si plusieurs) + description en légende.
// La hauteur est figée au viewport : seule la légende peut scroller, jamais la page derrière.
function PhotoOverlay({ item, onClose }: { item: AnomalieItem; onClose: () => void }) {
  const photos = item.photos;
  const [index, setIndex] = useState(0);
  // Position du doigt au début du geste, pour détecter un swipe horizontal.
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
    // Verrouille le scroll de la page tant que l'overlay est ouvert.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose, go, photos.length]);

  // Rendu dans <body> et pas sur place : la modale DSFR pose un `filter: drop-shadow` sur
  // `.fr-modal__body`, ce qui en fait un bloc conteneur pour `position: fixed`. Sans le portail,
  // l'overlay se cale sur la modale — taille variable, photo plus ou moins grande, et la liste
  // d'anomalies continue de scroller derrière.
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
          /* Les flèches sont hors de l'image, sur le fond noir : elles restent lisibles
             quelle que soit la photo affichée. */
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
