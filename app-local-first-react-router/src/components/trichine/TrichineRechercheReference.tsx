import { useNavigate } from 'react-router';
import type { GroupBase, StylesConfig } from 'react-select';
import SelectCustom from '@app/components/SelectCustom';

/**
 * Accès direct par référence : les objets trichine sont identifiés par des références
 * parlantes (E-/P-/F-), c'est ce que citent les laboratoires et les détenteurs au téléphone.
 * À gros volume, on retrouve un objet en le choisissant ici plutôt qu'en filtrant une liste.
 *
 * Combobox et non champ libre : on ne propose que des références qui existent, donc pas
 * d'écran d'erreur au bout d'une faute de frappe. Présentée comme une barre de recherche
 * (loupe, pas de chevron) pour qu'on la lise comme telle et non comme une liste déroulante.
 */
export type ReferenceOption = {
  /** Chemin vers lequel naviguer */
  value: string;
  /** La référence elle-même */
  label: string;
  /** Contexte affiché à côté, et cherchable */
  detail: string;
};

export type ReferenceGroupe = { label: string; options: Array<ReferenceOption> };

const rechercheStyles: StylesConfig<ReferenceOption, false, GroupBase<ReferenceOption>> = {
  control: (styles) => ({
    ...styles,
    minHeight: '2.5rem',
    backgroundColor: 'transparent',
    border: 'none',
    boxShadow: 'none',
    cursor: 'text',
    paddingLeft: '2rem',
  }),
  valueContainer: (styles) => ({ ...styles, padding: '2px 8px' }),
  placeholder: (styles) => ({ ...styles, color: 'var(--text-mention-grey)', whiteSpace: 'nowrap' }),
  indicatorSeparator: () => ({ display: 'none' }),
  menuPortal: (styles) => ({ ...styles, zIndex: 10000 }),
  menu: (styles) => ({
    ...styles,
    zIndex: 10000,
    borderRadius: '0.5rem',
    overflow: 'hidden',
    boxShadow: '0 8px 24px rgba(0, 0, 18, 0.16)',
  }),
  groupHeading: (styles) => ({
    ...styles,
    fontSize: '0.7rem',
    fontWeight: 700,
    letterSpacing: '0.04em',
    color: 'var(--text-mention-grey)',
    backgroundColor: 'var(--background-alt-grey)',
    padding: '6px 12px',
    margin: 0,
  }),
  option: (styles, state) => ({
    ...styles,
    backgroundColor: state.isFocused ? 'var(--background-alt-blue-france)' : 'transparent',
    color: 'var(--text-default-grey)',
    cursor: 'pointer',
    padding: '8px 12px',
  }),
};

export default function TrichineRechercheReference({
  groupes,
  placeholder = 'Rechercher une référence…',
  hint = 'Tapez une référence, un n° de marquage ou un laboratoire',
}: {
  groupes: Array<ReferenceGroupe>;
  placeholder?: string;
  hint?: string;
}) {
  const navigate = useNavigate();

  return (
    <div className="relative rounded-lg border border-gray-300 bg-white focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#0a76f6]">
      <span
        className="fr-icon-search-line fr-icon--sm text-action-high-blue-france pointer-events-none absolute top-1/2 left-3 z-10 -translate-y-1/2"
        aria-hidden="true"
      />
      <SelectCustom<ReferenceOption>
        options={groupes}
        value={null}
        aria-label="Rechercher une référence trichine"
        placeholder={placeholder}
        styles={rechercheStyles}
        components={{ DropdownIndicator: null }}
        onChange={(option) => {
          const selected = option as ReferenceOption | null;
          if (selected) navigate(selected.value);
        }}
        formatOptionLabel={(option) => (
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-semibold">{option.label}</span>
            <span className="fr-text--xs text-gray-600">{option.detail}</span>
          </span>
        )}
        filterOption={(option, input) => {
          if (!input) return true;
          const cible = `${option.data.label} ${option.data.detail}`.toLowerCase();
          return cible.includes(input.toLowerCase());
        }}
        noOptionsMessage={({ inputValue }) =>
          inputValue ? `Aucune référence ne correspond à « ${inputValue} »` : hint
        }
      />
    </div>
  );
}
