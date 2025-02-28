import React, { useRef, useState } from 'react';
import { Input, InputProps } from '@codegouvfr/react-dsfr/Input';
import { Tag } from '@codegouvfr/react-dsfr/Tag';
import InputNotEditable from './InputNotEditable';

interface InputForSearchPrefilledDataProps<T> {
  label: InputProps['label'];
  data: Array<T>;
  onSelect: (selected: T) => void;
  onRemove?: (selected: T) => void;
  hintText?: InputProps['hintText'];
  name?: string;
  placeholder?: string;
  required?: boolean;
  values?: Array<T>;
  defaultValue?: T;
  hideDataWhenNoSearch?: boolean;
  addSearchToClickableLabel?: boolean;
  clearInputOnClick?: boolean;
  canEdit?: boolean;
}

export default function InputForSearchPrefilledData<T extends string>({
  label,
  onSelect,
  data,
  onRemove,
  hintText = '',
  placeholder = 'Tapez ici...',
  name = 'input-for-search-prefilled-data',
  values = [],
  defaultValue,
  hideDataWhenNoSearch = true,
  addSearchToClickableLabel = true,
  clearInputOnClick = false,
  canEdit = true,
  required = false,
}: InputForSearchPrefilledDataProps<T>) {
  const [searchTerm, setSearchTerm] = useState<T>((defaultValue ?? '') as T);
  const showTags = useRef(!defaultValue);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    showTags.current = true;
    setSearchTerm(event.target.value as T);
  };

  const searchWords = searchTerm.toLowerCase().split(' ');
  const filteredData = !searchTerm?.length
    ? hideDataWhenNoSearch
      ? []
      : data
    : data.filter((item) => {
        const lowercaseItem = item.toLocaleLowerCase();
        for (const word of searchWords) {
          if (!lowercaseItem.includes(word)) {
            return false;
          }
        }
        return true;
      });

  if (addSearchToClickableLabel && !filteredData.includes(searchTerm) && searchTerm.length) {
    filteredData.push(searchTerm);
  }

  const Component = canEdit ? Input : InputNotEditable;

  return (
    <div>
      <Component
        label={label}
        hintText={hintText}
        nativeInputProps={{
          type: 'text',
          value: searchTerm,
          name,
          required,
          autoComplete: 'off',
          onChange: handleChange,
          placeholder,
        }}
      />
      {showTags.current && !!values.length && (
        <ul className="gap-y flex flex-wrap gap-x-2">
          {values.map((item) => (
            <li key={item} className="block">
              <Tag
                iconId="fr-icon-checkbox-circle-line"
                dismissible
                nativeButtonProps={{
                  onClick: () => onRemove?.(item),
                }}
              >
                {item}
              </Tag>
            </li>
          ))}
        </ul>
      )}
      {showTags.current && (
        <ul className="gap-y flex flex-wrap gap-x-2">
          {filteredData.map((item) => (
            <li key={item}>
              <Tag
                // iconId="fr-icon-checkbox-circle-line"
                className="text-left"
                nativeButtonProps={{
                  onClick: () => {
                    showTags.current = false;
                    onSelect(item);
                    if (clearInputOnClick) {
                      setSearchTerm('' as T);
                    } else {
                      setSearchTerm(item);
                    }
                  },
                }}
              >
                {item}
              </Tag>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
