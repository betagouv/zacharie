import { useCallback, useEffect, useRef } from 'react';
import Sortable from 'sortablejs';
import useMinimumWidth from '@app/utils/useMinimumWidth';
import dayjs from 'dayjs';

interface Column<T> {
  title: string;
  dataKey: keyof T;
  type?: 'date' | 'datetime' | 'number' | 'string';
  sortableKey?: keyof T;
  onSortBy?: (key: keyof T) => void;
  onSortOrder?: (order: 'ASC' | 'DESC') => void;
  sortBy?: keyof T;
  sortOrder?: 'ASC' | 'DESC';
  className?: string;
  style?: React.CSSProperties;
  help?: React.ReactNode;
  render?: (item: T, index: number) => React.ReactNode;
  small?: boolean;
}

interface TableProps<T> {
  columns: Array<Column<T>>;
  data: Array<T>;
  rowKey: keyof T;
  checked?: Array<string>;
  onCheck?: (checked: Array<string>) => void;
  dataTestId?: keyof T;
  withCheckbox?: boolean;
  onRowClick?: (item: T) => void;
  rowDisabled?: (item: T) => boolean;
  nullDisplay?: string;
  className?: string;
  title?: string;
  noData?: string;
  isSortable?: boolean;
  onSort?: (newOrder: Array<string>, data: Array<T>) => void;
  renderCellSmallDevices?: (item: T, index: number) => React.ReactNode;
}

export default function TableFilterable<T>({
  columns = [],
  data = [],
  checked = [],
  onCheck,
  rowKey,
  dataTestId,
  withCheckbox = false,
  onRowClick,
  rowDisabled = () => false,
  className,
  title = '',
  noData,
  isSortable = false,
  onSort,
  renderCellSmallDevices,
}: TableProps<T>) {
  const gridRef = useRef<HTMLTableSectionElement>(null);
  const sortableJsRef = useRef<Sortable | null>(null);

  const onListChange = useCallback(() => {
    if (!isSortable) return;
    if (!gridRef.current) return;
    // @ts-expect-error gridRef.current.children is not typed
    const newOrder = [...gridRef.current.children].map((i: HTMLElement) => {
      return i.dataset.key!;
    });
    onSort?.(newOrder, data);
  }, [onSort, data, isSortable]);

  const onToggleCheckbox = (event: React.ChangeEvent<HTMLInputElement>) => {
    const id = event.currentTarget.id;
    if (checked.includes(id)) {
      onCheck?.(checked.filter((i) => i !== id));
    } else {
      onCheck?.([...checked, id]);
    }
  };

  useEffect(() => {
    if (!!isSortable && !!data.length) {
      sortableJsRef.current = new Sortable(gridRef.current as HTMLElement, {
        animation: 150,
        onEnd: onListChange,
      });
    }
  }, [onListChange, isSortable, data.length]);

  const isDesktop = useMinimumWidth('sm');

  if (!data.length && noData) {
    return (
      <table className={[className, 'table-custom'].join(' ')}>
        <thead>
          {!!title && (
            <tr>
              <td className="title" colSpan={columns.length}>
                {title}
              </td>
            </tr>
          )}
          <tr className="cursor-default">
            <td colSpan={columns.length}>
              <p className="m-0 mb-5 text-center">{noData}</p>
            </td>
          </tr>
        </thead>
      </table>
    );
  }

  if (isDesktop || !renderCellSmallDevices) {
    return (
      <table className={[className, 'table-custom'].join(' ')}>
        <thead className="hidden sm:table-header-group border-b border-gray-200">
          {!!title && (
            <tr>
              <td tabIndex={0} aria-label={title} className="title" colSpan={columns.length}>
                {title}
              </td>
            </tr>
          )}
          <tr>
            {withCheckbox && (
              <td className="whitespace-nowrap cursor-default">
                <input
                  type="checkbox"
                  className="border-2 mx-2 checked:accent-action-high-blue-france"
                  checked={checked.length === data.length}
                  onChange={() => {
                    if (checked.length === data.length) {
                      onCheck?.([]);
                    } else {
                      onCheck?.(data.map((i) => i[rowKey] as string));
                    }
                  }}
                />
              </td>
            )}
            {columns.map((column) => {
              const { onSortBy, onSortOrder, sortBy, sortOrder, sortableKey, dataKey } = column;
              const onNameClick = () => {
                if (sortBy === sortableKey || sortBy === dataKey) {
                  onSortOrder?.(sortOrder === 'ASC' ? 'DESC' : 'ASC');
                  return;
                }
                onSortBy?.(sortableKey || dataKey);
              };
              return (
                <td
                  className={[
                    'whitespace-nowrap',
                    column.className || '',
                    onSortBy ? 'cursor-pointer' : 'cursor-default',
                  ].join(' ')}
                  style={column.style || {}}
                  key={String(dataKey) + String(column.title)}
                >
                  {onSortBy ? (
                    <button aria-label="Changer l'ordre de tri" type="button" onClick={onNameClick}>
                      {column.title}
                    </button>
                  ) : (
                    <span>{column.title}</span>
                  )}
                  {column.help && <>{column.help}</>}
                  {!!onSortBy && (sortBy === sortableKey || sortBy === dataKey) && (
                    <button onClick={onNameClick} type="button" aria-label="Changer l'ordre de tri">
                      {sortOrder === 'ASC' && (
                        <span className="mx-1" onClick={() => onSortOrder?.('DESC')}>{`\u00A0\u2193`}</span>
                      )}
                      {sortOrder === 'DESC' && (
                        <span className="mx-1" onClick={() => onSortOrder?.('ASC')}>{`\u00A0\u2191`}</span>
                      )}
                    </button>
                  )}
                </td>
              );
            })}
          </tr>
        </thead>
        <tbody ref={gridRef}>
          {data
            .filter((e) => e)
            .map((item, index) => {
              return (
                <tr
                  onClick={() => (!rowDisabled(item) && onRowClick ? onRowClick(item) : null)}
                  onKeyUp={(event) => {
                    if (event.key === 'Enter')
                      if (!rowDisabled(item) && onRowClick) {
                        onRowClick(item);
                      }
                  }}
                  key={item[rowKey] as string}
                  data-key={item[rowKey]}
                  data-test-id={dataTestId ? item[dataTestId] : item[rowKey]}
                  tabIndex={0}
                  className={[
                    rowDisabled(item)
                      ? 'cursor-not-allowed'
                      : isSortable
                        ? 'cursor-move'
                        : onRowClick
                          ? 'cursor-pointer'
                          : 'cursor-auto',
                  ].join(' ')}
                >
                  {withCheckbox && (
                    <td className="whitespace-nowrap cursor-default">
                      <input
                        type="checkbox"
                        className="border-2 mx-2  checked:accent-action-high-blue-france"
                        checked={checked.includes(item[rowKey] as string)}
                        id={item[rowKey] as string}
                        onChange={onToggleCheckbox}
                      />
                    </td>
                  )}
                  {columns.map((column) => {
                    return (
                      <td
                        className={([column.className || ''].join(' '), column.small ? 'small' : 'not-small')}
                        key={`${item[rowKey] as string}${String(column.dataKey)}`}
                      >
                        {column.render
                          ? column.render(item, index)
                          : renderForType(item[column.dataKey], column.type || 'string')}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
        </tbody>
      </table>
    );
  }

  return (
    <table>
      <tbody ref={gridRef}>{data.filter((e) => e).map(renderCellSmallDevices)}</tbody>
    </table>
  );
}

function renderForType<T>(value: T, type: 'date' | 'datetime' | 'number' | 'string') {
  if (['date', 'datetime'].includes(type)) {
    if (!value) return null;
    if (type === 'date') return dayjs(value as string).format('DD/MM/YYYY');
    if (type === 'datetime') return dayjs(value as string).format('DD/MM/YYYY HH:mm');
  }
  return value as React.ReactNode;
}
