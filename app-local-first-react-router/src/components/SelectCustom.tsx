/* eslint-disable @typescript-eslint/no-explicit-any */
import { Fragment } from 'react';
import Select from 'react-select';
import CreatableSelect from 'react-select/creatable';
import type { GroupBase, Props, StylesConfig } from 'react-select';
import InputNotEditable from './InputNotEditable';

export interface SelectCustomProps<
  Option,
  IsMulti extends boolean = false,
  Group extends GroupBase<Option> = GroupBase<Option>,
> extends Props<Option, IsMulti, Group> {
  creatable?: boolean;
  label?: string;
  hint?: React.ReactNode;
  isReadOnly?: boolean;
}

function SelectCustom<
  Option,
  IsMulti extends boolean = false,
  Group extends GroupBase<Option> = GroupBase<Option>,
>(allProps: SelectCustomProps<Option, IsMulti, Group>) {
  const { creatable, isReadOnly, label, hint, ...props } = allProps;
  const Component = creatable ? CreatableSelect : Select;

  const filterStyles: StylesConfig<Option, IsMulti, Group> = {
    control: (styles) => ({
      ...styles,
      backgroundColor: 'var(--background-contrast-grey)',
      border: 'none',
      borderBottomLeftRadius: '0',
      borderBottomRightRadius: '0',
      boxShadow: props.isDisabled
        ? 'inset 0 -2px 0 0 var(--border-disabled-grey)'
        : 'inset 0 -2px 0 0 var(--border-plain-grey)',
    }),
    dropdownIndicator: (styles) => ({
      ...styles,
      color: props.isDisabled ? 'transparent' : 'var(--text-default-grey)',
    }),
    valueContainer: (styles) => ({ ...styles, padding: '4px 8px' }),
    option: (styles: any, { data, isFocused, isSelected }: any) => ({
      ...styles,
      color: isFocused || isSelected ? '#fff' : data.color,
    }),
    placeholder: (styles) => ({
      ...styles,
      color: props.isDisabled ? 'var(--text-disabled-grey)' : 'var(--text-default-grey)',
    }),
    indicatorSeparator: (styles: any) => ({ ...styles, borderWidth: 0, backgroundColor: 'transparent' }),
    menuPortal: (provided: any) => ({ ...provided, zIndex: 10000 }),
    menu: (provided: any) => ({ ...provided, zIndex: 10000 }),
  };

  if (isReadOnly) {
    return (
      <InputNotEditable
        label={label}
        hintText={hint}
        nativeInputProps={{
          value: props.value
            ? Array.isArray(props.value)
              ? props.value.length > 0
                ? props?.getOptionLabel?.(props.value[0] as Option) || ''
                : ''
              : props?.getOptionLabel?.(props.value as Option) || ''
            : '',
          readOnly: true,
        }}
      />
    );
  }

  const Wrapper = label ? 'div' : Fragment;

  return (
    <Wrapper>
      {label && (
        <label
          className={['fr-label mb-2', props.isDisabled ? 'text-disabled-grey' : ''].join(' ')}
          htmlFor={props.inputId}
        >
          {label}
          {hint && typeof hint === 'string' && <span className="fr-hint-text mt-1">{hint}</span>}
          {hint && typeof hint !== 'string' && (
            <div className="fr-hint-text mt-1 flex flex-col gap-1">{hint}</div>
          )}
        </label>
      )}
      <Component
        // These two options seems magical, they make the dropdown appear on top of everything
        // https://stackoverflow.com/a/64973481/978690
        menuPosition="fixed"
        className={[props.className, props.isDisabled ? 'text-disabled-grey' : ''].join(' ')}
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
    </Wrapper>
  );
}

export default SelectCustom;
