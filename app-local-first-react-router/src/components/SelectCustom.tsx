/* eslint-disable @typescript-eslint/no-explicit-any */
import Select from 'react-select';
import CreatableSelect from 'react-select/creatable';
import type { GroupBase, Props, StylesConfig } from 'react-select';

export interface SelectCustomProps<
  Option,
  IsMulti extends boolean = false,
  Group extends GroupBase<Option> = GroupBase<Option>,
> extends Props<Option, IsMulti, Group> {
  creatable?: boolean;
}

function SelectCustom<
  Option,
  IsMulti extends boolean = false,
  Group extends GroupBase<Option> = GroupBase<Option>,
>(allProps: SelectCustomProps<Option, IsMulti, Group>) {
  const { creatable, ...props } = allProps;
  const Component = creatable ? CreatableSelect : Select;

  const filterStyles: StylesConfig<Option, IsMulti, Group> = {
    control: (styles) => ({
      ...styles,
      backgroundColor: 'var(--background-contrast-grey)',
      border: 'none',
      borderBottomLeftRadius: '0',
      borderBottomRightRadius: '0',
      boxShadow: 'inset 0 -2px 0 0 var(--border-plain-grey)',
    }),
    dropdownIndicator: (styles) => ({ ...styles, color: 'var(--text-default-grey)' }),
    valueContainer: (styles) => ({ ...styles, padding: '4px 8px' }),
    option: (styles: any, { data, isFocused, isSelected }: any) => ({
      ...styles,
      color: isFocused || isSelected ? '#fff' : data.color,
    }),
    placeholder: (styles) => ({ ...styles, color: 'var(--text-default-grey)' }),
    indicatorSeparator: (styles: any) => ({ ...styles, borderWidth: 0, backgroundColor: 'transparent' }),
    menuPortal: (provided: any) => ({ ...provided, zIndex: 10000 }),
    menu: (provided: any) => ({ ...provided, zIndex: 10000 }),
  };

  return (
    <Component
      // These two options seems magical, they make the dropdown appear on top of everything
      // https://stackoverflow.com/a/64973481/978690
      menuPosition="fixed"
      menuPortalTarget={document.body}
      styles={filterStyles}
      placeholder="Choisir..."
      noOptionsMessage={() => 'Aucun résultat'}
      formatCreateLabel={(inputValue) => `Ajouter "${inputValue}"`}
      theme={(defaultTheme) => ({
        ...defaultTheme,
        colors: {
          ...defaultTheme.colors,
          primary: '#000091',
          primary25: '#000091CC',
          primary50: '#00009188',
          primary75: '#00009133',
        },
      })}
      instanceId={props.name}
      inputId={props.inputId}
      classNamePrefix={props.classNamePrefix}
      {...props}
    />
  );
}

export default SelectCustom;
