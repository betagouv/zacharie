import { useState } from 'react';
import { Input } from '@codegouvfr/react-dsfr/Input';
import dayjs from 'dayjs';
import { Select } from '@codegouvfr/react-dsfr/Select';
import { mapCarcasseStatusLabelToValue } from '@app/utils/filter-carcasse';
import type { Filter, FilterableField } from '@app/types/filter';

// const filterItem =
//   (filters: Array<Filter>, debug = false) =>
//   (item: { [x: string]: any }) => {
//     // for now an item needs to fulfill ALL items to be displayed
//     if (!filters?.filter((f) => Boolean(f?.value)).length) return item;
//     for (const filter of filters) {
//       if (debug) console.log('filter', filter);
//       if (!filter.field || !filter.value) continue;
//       const itemValue = item[filter.field];
//       if (['number'].includes(filter.type)) {
//         const itemNumber = Number(itemValue);
//         const { number, number2, comparator } = filter.value;
//         if (comparator === 'unfilled') {
//           if (typeof itemNumber === 'number') return false;
//           continue;
//         }
//         // be careful:
//         // now we want to exclude everything that is not a number
//         // BUT we can't use `isNaN` here because if itemValue is `null`, isNaN(null) === false, because `Number(null) === 0`
//         if (typeof itemNumber !== 'number') return false;
//         if (comparator === 'between') {
//           if (Number(number) < Number(number2)) {
//             if (Number(itemNumber) >= Number(number) && Number(itemNumber) <= Number(number2)) continue;
//             return false;
//           } else {
//             if (Number(itemNumber) >= Number(number2) && Number(itemNumber) <= Number(number)) continue;
//             return false;
//           }
//         }
//         if (comparator === 'equals') {
//           if (Number(itemNumber) === Number(number)) continue;
//           return false;
//         }
//         if (comparator === 'lower') {
//           if (Number(itemNumber) < Number(number)) continue;
//           return false;
//         }
//         if (comparator === 'greater') {
//           if (Number(itemNumber) > Number(number)) continue;
//           return false;
//         }
//       }
//       if (['boolean'].includes(filter.type)) {
//         if (filter.value === 'Oui' && !!itemValue) continue;
//         if (filter.value === 'Non' && !itemValue) continue;
//         return false;
//       }
//       if (['date-with-time', 'date', 'duration'].includes(filter.type)) {
//         const { date, comparator } = filter.value;
//         if (comparator === 'unfilled') {
//           if (!itemValue) continue;
//           return false;
//         }
//         if (!itemValue) return false;
//         if (comparator === 'before') {
//           if (dayjs(itemValue).isBefore(date)) continue;
//           return false;
//         }
//         if (comparator === 'after') {
//           if (dayjs(itemValue).isAfter(date)) continue;
//           return false;
//         }
//         if (comparator === 'equals') {
//           if (dayjs(itemValue).isSame(dayjs(date), 'day')) continue;
//           return false;
//         }
//       }

//       if (typeof itemValue === 'boolean') {
//         if (!itemValue) {
//           if (filter.value === 'Non renseigné') continue;
//           return false;
//         }
//         if (itemValue === (filter.value === 'Oui')) continue;
//         return false;
//       }

//       const arrayFilterValue = Array.isArray(filter.value) ? filter.value : [filter.value];
//       if (!arrayFilterValue.length) continue;
//       // here the item needs to fulfill at least one filter value
//       let isSelected = false;
//       for (const filterValue of arrayFilterValue) {
//         if (!itemValue?.length && filterValue === 'Non renseigné') {
//           isSelected = true;
//           break;
//         }
//         if (typeof itemValue === 'string') {
//           // For type text we trim and lower case the value.
//           if (filter.type === 'text') {
//             const trimmedItemValue = (itemValue || '').trim().toLowerCase();
//             const trimmedFilterValue = (filterValue || '').trim().toLowerCase();
//             if (trimmedItemValue.includes(trimmedFilterValue)) {
//               isSelected = true;
//               break;
//             }
//           }
//           if (itemValue === filterValue) {
//             isSelected = true;
//             break;
//           }
//         } else {
//           if (itemValue?.includes?.(filterValue)) {
//             isSelected = true;
//           }
//         }
//       }
//       if (!isSelected) return false;
//     }
//     return item;
//   };

const emptyFilter: Filter = { field: undefined, type: 'text', value: undefined };

export default function Filters({
  onChange,
  base,
  filters,
  title = 'Filtres :',
  saveInURLParams = false,
}: {
  onChange: (filters: Array<Filter>, saveInURLParams: boolean) => void;
  base: Array<FilterableField>;
  filters: Array<Filter>;
  title?: string;
  saveInURLParams?: boolean;
}) {
  filters = filters.length ? filters : [emptyFilter];
  const onAddFilter = () => onChange([...filters, emptyFilter], saveInURLParams);
  const filterFields = base
    .filter((_filter) => _filter.name !== 'alertness')
    .map((f) => ({ label: f.label, field: f.name, type: f.type }));

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

  function getFilterValue(filterValue: Filter['value']) {
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
          {filters.map((filter: Filter, index: number) => {
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
      <div className="border-b print:hidden z-10 mb-4 flex w-full flex-col justify-center gap-2 self-center border-gray-300">
        <div className="flex flex-wrap">
          <p className="m-0">{title}</p>
        </div>
        <div className="w-full">
          {filters.map((filter: Filter, index: number) => {
            // filter: field, value, type
            const filterValues = getFilterOptionsByField(filter.field!, base, index);
            const onChangeField = (newField: FilterableField) => {
              onChange(
                filters.map((_filter, i) =>
                  i === index ? { field: newField?.name, value: null, type: newField?.type } : _filter,
                ),
                saveInURLParams,
              );
            };
            const onChangeValue = (newValue: Filter['value']) => {
              onChange(
                filters.map((f: Filter, i: number) =>
                  i === index ? { field: filter.field, value: newValue, type: filter.type } : f,
                ),
                saveInURLParams,
              );
            };
            const onRemoveFilter = () => {
              onChange(
                filters.filter((_f: Filter, i: number) => i !== index),
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
                  <Select
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
                  </Select>
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
                  {!!filters.filter((_filter: Filter) => Boolean(_filter.field)).length && (
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

type ValueSelectorProps = {
  index: number;
  field?: string;
  filterValues: string[];
  value: Filter['value'];
  onChangeValue: (value: Filter['value']) => void;
  base: Array<FilterableField>;
};

function ValueSelector({ field, filterValues, value, onChangeValue, base }: ValueSelectorProps) {
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
          className={`tailwindui !mt-0 grow ${unfilledChecked ? '!text-gray-400' : ''}`}
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
          <label htmlFor="unfilled" className="pt-2 text-xs">
            Non renseigné
          </label>
        </div>
      </div>
    );
  }

  if (['date-with-time', 'date', 'duration'].includes(type)) {
    return (
      <div className="-mx-4 flex flex-wrap">
        <div
          className={['pl-4', value?.comparator !== 'unfilled' ? 'basis-1/2 pr-2' : 'basis-full pr-4'].join(
            ' ',
          )}
        >
          <Select
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
          </Select>
        </div>
        {value?.comparator !== 'unfilled' && (
          <div className="basis-1/2 pr-4">
            <Input
              id={name}
              label=""
              nativeInputProps={{
                type: 'date',
                value: value?.date ? new Date(value?.date).toString() : '',
                onChange: (e) => onChangeValue({ date: e.target.value, comparator }),
              }}
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
          <Select
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
          </Select>
        </div>
        {value?.comparator !== 'unfilled' && (
          <div className={['pr-4', value?.comparator === 'between' ? 'basis-3/12' : 'basis-1/2'].join(' ')}>
            <input
              name={name}
              className="tailwindui !mt-0"
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
                className="tailwindui !mt-0"
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
      return (
        <Select
          label=""
          nativeSelectProps={{
            id: name,
            name: name,
            value: value,
            // multiple: true,
            onChange: (e) => onChangeValue(e.target.value),
          }}
        >
          {filterValues.map((_value) => (
            <option key={_value} value={_value}>
              {_value}
            </option>
          ))}
        </Select>
      );

      // eslint-disable-next-line no-empty
    } catch (_e) {}
    return null;
  }

  return (
    <Select
      label=""
      nativeSelectProps={{
        id: name,
        name: name,
        value: value,
        onChange: (e) => onChangeValue(e.target.value),
      }}
    >
      {filterValues.map((_value) => (
        <option key={_value} value={_value}>
          {_value}
        </option>
      ))}
    </Select>
  );
}
