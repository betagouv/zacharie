import React, { useState } from "react";
import { Input, InputProps } from "@codegouvfr/react-dsfr/Input";
import { Tag } from "@codegouvfr/react-dsfr/Tag";

interface InputForSearchPrefilledDataProps<T> {
  label: InputProps["label"];
  data: Array<T>;
  onSelect: (selected: T) => void;
  onRemove?: (selected: T) => void;
  hintText?: InputProps["hintText"];
  placeholder?: string;
  values?: Array<T>;
  hideDataWhenNoSearch?: boolean;
}

export default function InputForSearchPrefilledData<T extends string>({
  label,
  onSelect,
  data,
  onRemove,
  hintText = "",
  placeholder = "Tapez ici...",
  values = [],
  hideDataWhenNoSearch = true,
}: InputForSearchPrefilledDataProps<T>) {
  const [searchTerm, setSearchTerm] = useState("");

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  const searchWords = searchTerm.toLowerCase().split(" ");
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

  return (
    <div>
      <Input
        label={label}
        hintText={hintText}
        className="[&_input]:bg-transparent"
        nativeInputProps={{
          type: "text",
          value: searchTerm,
          onChange: handleChange,
          placeholder,
        }}
      />
      {!!values.length && (
        <ul className="flex flex-wrap gap-x-2 gap-y">
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
      <ul className="flex flex-wrap gap-x-2 gap-y">
        {filteredData.map((item) => (
          <li key={item}>
            <Tag
              // iconId="fr-icon-checkbox-circle-line"
              nativeButtonProps={{
                onClick: () => onSelect(item),
              }}
            >
              {item}
            </Tag>
          </li>
        ))}
      </ul>
    </div>
  );
}
