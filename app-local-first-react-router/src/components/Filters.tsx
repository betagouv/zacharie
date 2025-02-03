import { useState } from 'react';
import dayjs from 'dayjs';
import { components } from 'react-select';
import type { Filter, FilterableField } from '@app/types/filter';
import SelectCustom from './SelectCustom';

export default function Filters<T extends Filter = Filter>({
  onChange,
  base,
  filters,
  title,
  saveInURLParams = false,
}: {
  onChange: (filters: Array<T>, saveInURLParams: boolean) => void;
  base: Array<FilterableField>;
  filters: Array<T>;
  title?: string;
  saveInURLParams?: boolean;
}) {
  const emptyFilter: T = { field: '', type: 'text', value: undefined } as T;
  filters = filters.length ? filters : [emptyFilter];
  const onAddFilter = () => onChange([...filters, emptyFilter], saveInURLParams);
  const filterFields = base
    .filter((_filter) => _filter.name !== 'alertness')
    .map((f) => ({ label: f.label!, field: f.name!, type: f.type!, value: null }));

  function getFilterOptionsByField(
    fieldName: FilterableField['name'],
    base: Array<FilterableField>,
    index: number,
  ): Array<string> {
    if (!fieldName) return [];
    const current = base.find((filter) => filter.name === fieldName);
    if (!current) {
      onChange(
        filters.filter((_f, i) => i !== index),
        saveInURLParams,
      );
      return [];
    }
    if (['yes-no'].includes(current.type)) return ['Oui', 'Non', 'Non renseigné'];
    if (['boolean'].includes(current.type)) return ['Oui', 'Non'];
    if (current?.options?.length) return [...(current?.options || []), 'Non renseigné'];
    return ['Non renseigné'];
  }

  function getFilterValue(filterValue: T['value']) {
    if (typeof filterValue === 'object') {
      if (filterValue?.date != null) {
        if (filterValue.comparator === 'unfilled') return 'Non renseigné';
        if (filterValue.comparator === 'before')
          return `Avant le ${dayjs(filterValue.date).format('DD/MM/YYYY')}`;
        if (filterValue.comparator === 'after')
          return `Après le ${dayjs(filterValue.date).format('DD/MM/YYYY')}`;
        if (filterValue.comparator === 'equals') return `Le ${dayjs(filterValue.date).format('DD/MM/YYYY')}`;
        return '';
      }
      if (filterValue?.number != null) {
        if (filterValue.comparator === 'unfilled') return 'Non renseigné';
        if (filterValue.comparator === 'between')
          return `Entre ${filterValue.number} et ${filterValue.number2}`;
        if (filterValue.comparator === 'equals') return `Égal à ${filterValue.number}`;
        if (filterValue.comparator === 'lower') return `Inférieur à ${filterValue.number}`;
        if (filterValue.comparator === 'greater') return `Supérieur à ${filterValue.number}`;
      }
      return '';
    }
    return filterValue;
  }

  return (
    <>
      <div className="hidden print:flex gap-2">
        {title ? <p>{title}</p> : null}
        <ul>
          {filters.map((filter: T, index: number) => {
            if (!filter?.field) return null;
            const current = base.find((filterableField) => filterableField.name === filter.field);
            if (!current) return null;
            const filterValue = getFilterValue(filter.value);
            if (!filterValue) return null;
            return (
              <li key={index} className="list-disc">
                {current.label}: {filterValue}
              </li>
            );
          })}
        </ul>
      </div>
      <div className="border-b print:hidden z-10 pb-2 mb-4 flex w-full flex-col justify-center gap-2 self-center border-gray-300">
        <div className="flex flex-wrap">
          <p className="m-0">{title}</p>
        </div>
        <div className="w-full">
          {filters.map((filter: T, index: number) => {
            // filter: field, value, type
            const filterValues = getFilterOptionsByField(filter.field!, base, index);
            const onChangeField = (newField: (typeof filterFields)[number] | null) => {
              if (newField) {
                onChange(
                  filters.map((_filter, i) =>
                    i === index
                      ? ({ field: newField?.field, value: null, type: newField?.type } as T)
                      : _filter,
                  ),
                  saveInURLParams,
                );
              }
            };
            const onChangeValue = (newValue: T['value']) => {
              onChange(
                filters.map((f: T, i: number) =>
                  i === index ? ({ field: filter.field, value: newValue, type: filter.type } as T) : f,
                ),
                saveInURLParams,
              );
            };
            const onRemoveFilter = () => {
              onChange(
                filters.filter((_f: T, i: number) => i !== index),
                saveInURLParams,
              );
            };

            return (
              <div
                data-test-id={`filter-${index}`}
                className="mx-auto mb-2.5 flex items-center gap-2"
                key={`${filter.field || 'empty'}${index}`}
              >
                <div className="min-w-[85px] shrink-0">
                  <p className="m-0 w-full pr-2 text-right">{index === 0 ? 'Filtrer par' : 'ET'}</p>
                </div>
                <div className="w-96 min-w-[384px]">
                  {/* <Select
                    label=""
                    nativeSelectProps={{
                      id: `filter-field-${index}`,
                      name: `filter-field-${index}`,
                      onChange: (e) => {
                        const field = base.find((field) => field.name === e.target.value);
                        if (field) {
                          onChangeField(field);
                        }
                      },
                      value: filter.field ?? '',
                    }}
                  >
                    {filterFields.map((field) => {
                      return (
                        <option key={field.field} value={field.field}>
                          {field.label}
                        </option>
                      );
                    })}
                  </Select> */}
                  <div className="tw-w-96 tw-min-w-[384px]">
                    <SelectCustom
                      // @ts-expect-error: The expected type comes from property 'options' which is declared here on type 'IntrinsicAttributes & SelectCustomProps<T, false, GroupBase<T>>'
                      options={filterFields}
                      value={filter.field ? filter : null}
                      onChange={onChangeField}
                      getOptionLabel={(_option) =>
                        filterFields.find((_filter) => _filter.field === _option.field)?.label || ''
                      }
                      getOptionValue={(_option) => _option.field || ''}
                      isClearable={true}
                      isMulti={false}
                      inputId={`filter-field-${index}`}
                      classNamePrefix={`filter-field-${index}`}
                    />
                  </div>
                </div>
                <div className="grow">
                  <ValueSelector
                    index={index}
                    field={filter.field}
                    filterValues={filterValues}
                    value={filter.value}
                    base={base}
                    onChangeValue={onChangeValue}
                  />
                </div>
                <div className="shrink-0">
                  {!!filters.filter((_filter: T) => Boolean(_filter.field)).length && (
                    <button
                      type="button"
                      className="h-full w-full rounded border border-gray-300 bg-white px-2.5 py-2 text-sm text-red-500 hover:bg-red-100"
                      onClick={onRemoveFilter}
                    >
                      Retirer
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex w-full">
          <div className="basis-1/12" />
          <button
            type="button"
            className="h-full rounded text-main disabled:opacity-20 hover:underline text-sm"
            onClick={onAddFilter}
            disabled={!!filters.find((f) => !f.field)}
          >
            + Ajouter un filtre
          </button>
        </div>
      </div>
    </>
  );
}

const dateOptions = [
  {
    label: 'Avant',
    value: 'before',
  },
  {
    label: 'Après',
    value: 'after',
  },
  {
    label: 'Date exacte',
    value: 'equals',
  },
  {
    label: 'Non renseigné',
    value: 'unfilled',
  },
];

const numberOptions = [
  {
    label: 'Inférieur à',
    value: 'lower',
  },
  {
    label: 'Supérieur à',
    value: 'greater',
  },
  {
    label: 'Égal à',
    value: 'equals',
  },
  {
    label: 'Entre',
    value: 'between',
  },
  {
    label: 'Non renseigné',
    value: 'unfilled',
  },
];

type ValueSelectorProps<T extends Filter = Filter> = {
  index: number;
  field?: string;
  filterValues: string[];
  value: T['value'];
  onChangeValue: (value: T['value']) => void;
  base: Array<FilterableField>;
};

function ValueSelector({ index, field, filterValues, value, onChangeValue, base }: ValueSelectorProps) {
  const [comparator, setComparator] = useState('');
  const [unfilledChecked, setUnfilledChecked] = useState(value === 'Non renseigné');
  if (!field) return <></>;
  const current = base.find((filter) => filter.name === field);
  if (!current) return <></>;
  const { type, name } = current;

  if (['text', 'textarea'].includes(type)) {
    return (
      <div className="flex">
        <input
          name={name}
          className={`tailwindui grow ${unfilledChecked ? '!text-gray-400' : ''}`}
          disabled={unfilledChecked}
          type="text"
          value={value || ''}
          onChange={(e) => {
            e.preventDefault();
            onChangeValue(e.target.value);
          }}
        />
        <div className="ml-2 flex shrink-0 items-center gap-1">
          <input
            type="checkbox"
            id="unfilled"
            className={`h-4 w-4`}
            checked={unfilledChecked}
            onChange={() => {
              setUnfilledChecked(!unfilledChecked);
              onChangeValue(unfilledChecked ? '' : 'Non renseigné');
            }}
          />
          <label htmlFor="unfilled" className="text-xs">
            Non renseigné
          </label>
        </div>
      </div>
    );
  }

  if (['date-with-time', 'date', 'duration'].includes(type)) {
    return (
      <div className="-mx-4 flex flex-wrap items-stretch">
        <div
          className={[
            'pl-4 h-full',
            value?.comparator !== 'unfilled' ? 'basis-1/2 pr-2' : 'basis-full pr-4',
          ].join(' ')}
        >
          {/* <Select
            label=""
            nativeSelectProps={{
              id: name,
              name: name,
              value: value?.comparator,
              onChange: (e) => {
                if (!e.target?.value) return setComparator('');
                setComparator(e.target.value);
                onChangeValue({ date: value?.date, comparator: e.target.value });
              },
            }}
          >
            {dateOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select> */}
          <SelectCustom
            options={dateOptions}
            value={dateOptions.find((opt) => opt.value === value?.comparator)}
            isClearable={!value}
            onChange={(e) => {
              if (!e) return setComparator('');
              setComparator(e.value);
              onChangeValue({ date: value?.date, comparator: e.value });
            }}
          />
        </div>
        {value?.comparator !== 'unfilled' && (
          <div className="basis-1/2 pr-4">
            <input
              id={name}
              className="tailwindui"
              type="date"
              value={value?.date ? new Date(value?.date).toString() : ''}
              onChange={(e) => onChangeValue({ date: e.target.value, comparator })}
            />
          </div>
        )}
      </div>
    );
  }

  if (['number'].includes(type)) {
    return (
      <div className="-mx-4 flex flex-wrap items-center">
        <div
          className={[
            'pl-4 pr-2',
            value?.comparator === 'unfilled' ? 'basis-full' : '',
            value?.comparator === 'between' ? 'basis-5/12' : '',
            !['unfilled', 'between'].includes(value?.comparator) ? 'basis-1/2' : '',
          ].join(' ')}
        >
          {/* <Select
            label=""
            nativeSelectProps={{
              id: name,
              name: name,
              value: value?.comparator,
              onChange: (e) => {
                if (!e.target?.value) return setComparator('');
                setComparator(e.target.value);
                onChangeValue({ number: value?.number, comparator: e.target.value });
              },
            }}
          >
            {numberOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select> */}
          <SelectCustom
            options={numberOptions}
            value={numberOptions.find((opt) => opt.value === value?.comparator)}
            isClearable={!value}
            onChange={(e) => {
              if (!e) return setComparator('');
              setComparator(e.value);
              onChangeValue({ number: value?.number, comparator: e.value });
            }}
          />
        </div>
        {value?.comparator !== 'unfilled' && (
          <div className={['pr-4', value?.comparator === 'between' ? 'basis-3/12' : 'basis-1/2'].join(' ')}>
            <input
              name={name}
              className="tailwindui"
              type="number"
              min="0"
              value={value?.number || ''}
              onChange={(e) => {
                onChangeValue({ number: e.target.value, number2: value?.number2, comparator });
              }}
            />
          </div>
        )}
        {value?.comparator === 'between' && (
          <>
            <div>et</div>
            <div className="basis-3/12 px-4">
              <input
                name={name}
                className="tailwindui"
                type="number"
                min="0"
                value={value?.number2 || ''}
                onChange={(e) => {
                  onChangeValue({ number2: e.target.value, number: value?.number, comparator });
                }}
              />
            </div>
          </>
        )}
      </div>
    );
  }

  if (['enum', 'multi-choice'].includes(type)) {
    try {
      // return (
      //   <Select
      //     label=""
      //     nativeSelectProps={{
      //       id: name,
      //       name: name,
      //       value: value,
      //       // multiple: true,
      //       onChange: (e) => onChangeValue(e.target.value),
      //     }}
      //   >
      //     {filterValues.map((_value) => (
      //       <option key={_value} value={_value}>
      //         {_value}
      //       </option>
      //     ))}
      //   </Select>
      // );

      return (
        <SelectCustom
          options={filterValues.map((_value: string) => ({ label: _value, value: _value }))}
          value={value?.map((_value: string) => ({ label: _value, value: _value })) || []}
          getOptionLabel={(f) => f.label}
          getOptionValue={(f) => f.value}
          onChange={(newValue) => onChangeValue(newValue?.map((option) => option.value))}
          isClearable={!value?.length}
          isMulti
          inputId={`filter-value-${index}`}
          classNamePrefix={`filter-value-${index}`}
          components={{
            MultiValueContainer: (props) => {
              if (props.selectProps?.value?.length <= 1) {
                return <components.MultiValueContainer {...props} />;
              }
              const lastValue = props.selectProps?.value?.[props.selectProps?.value?.length - 1]?.value;
              const isLastValue = props?.data?.value === lastValue;
              return (
                <>
                  <components.MultiValueLabel {...props} />
                  {!isLastValue && <span className="tw-ml-1 tw-mr-2 tw-inline-block">OU</span>}
                </>
              );
            },
          }}
        />
      );
    } catch (_e) {
      console.error(_e);
    }
    return null;
  }

  // return (
  //   <Select
  //     label=""
  //     nativeSelectProps={{
  //       id: name,
  //       name: name,
  //       value: value,
  //       onChange: (e) => onChangeValue(e.target.value),
  //     }}
  //   >
  //     {filterValues.map((_value) => (
  //       <option key={_value} value={_value}>
  //         {_value}
  //       </option>
  //     ))}
  //   </Select>
  // );
  return (
    <SelectCustom
      options={filterValues.map((_value) => ({ label: _value, value: _value }))}
      value={value ? { label: value, value } : null}
      getOptionLabel={(f) => f.label}
      getOptionValue={(f) => f.value}
      onChange={(f) => onChangeValue(f?.value)}
      isClearable={!value}
      inputId={`filter-value-${index}`}
      classNamePrefix={`filter-value-${index}`}
    />
  );
}
