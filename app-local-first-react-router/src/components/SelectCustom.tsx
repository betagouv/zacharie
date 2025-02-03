/* eslint-disable @typescript-eslint/no-explicit-any */
import Select from 'react-select';
import CreatableSelect from 'react-select/creatable';
import type { GroupBase, Props } from 'react-select';

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

const filterStyles = {
  // control: (styles) => ({ ...styles, borderWidth: 0 }),
  option: (styles: any, { data, isFocused, isSelected }: any) => ({
    ...styles,
    color: isFocused || isSelected ? '#fff' : data.color,
  }),
  indicatorSeparator: (styles: any) => ({ ...styles, borderWidth: 0, backgroundColor: 'transparent' }),
  menuPortal: (provided: any) => ({ ...provided, zIndex: 10000 }),
  menu: (provided: any) => ({ ...provided, zIndex: 10000 }),
};

export default SelectCustom;
