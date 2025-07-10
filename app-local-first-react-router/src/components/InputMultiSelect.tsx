import type { InputProps } from '@codegouvfr/react-dsfr/Input';
import SelectCustom from './SelectCustom';

interface InputMultiSelectProps<T> {
  label: InputProps['label'];
  data: Array<T>;
  onChange: (selected: Array<T>) => void;
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

export default function InputMultiSelect<T extends string>({
  label,
  data,
  onChange,
  hintText = '',
  placeholder = 'Tapez ici...',
  name = 'input-for-search-prefilled-data',
  values = [],
  canEdit = true,
  required = false,
}: InputMultiSelectProps<T>) {
  return (
    <div className="fr-input-group">
      <label className="fr-label" htmlFor="input-«re»">
        {label}
        {hintText && <span className="fr-hint-text">{hintText}</span>}
      </label>
      <SelectCustom
        options={data.map((_value: string) => ({
          label: _value,
          value: _value,
        }))}
        value={values?.map((_value: string) => ({ label: _value, value: _value })) || []}
        getOptionLabel={(f) => f.label}
        getOptionValue={(f) => f.value}
        onChange={(newValue) => onChange(newValue?.map((option) => option.value as T))}
        placeholder={placeholder}
        isClearable={!values?.length}
        isMulti
        inputId={`${name}`}
        isDisabled={!canEdit}
        required={required}
        classNamePrefix={`${name}`}
        className="mt-2"
        // components={{
        //   MultiValueContainer: (props) => {
        //     if (props.selectProps?.value?.length <= 1) {
        //       return <components.MultiValueContainer {...props} />;
        //     }
        //     const lastValue = props.selectProps?.value?.[props.selectProps?.value?.length - 1]?.value;
        //     const isLastValue = props?.data?.value === lastValue;
        //     return (
        //       <>
        //       <components.MultiValueLabel {...props} />
        //       {!isLastValue && <span className="tw-ml-1 tw-mr-2 tw-inline-block">OU</span>}
        //       </>
        //     );
        //   },
        // }}
      />
    </div>
  );
}
