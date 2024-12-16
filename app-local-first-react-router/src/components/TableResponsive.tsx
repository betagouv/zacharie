import Checkbox from '@codegouvfr/react-dsfr/Checkbox';
import { Link } from 'react-router';
import { Fragment } from 'react/jsx-runtime';

type TableProps = {
  headers: string[];
  data: Array<{ link: string; id: string; cols: Array<string | JSX.Element>; isSynced: boolean }>;
  onCheckboxClick: (id: string) => void;
  checkedItemIds: string[];
  strongId?: boolean;
};

export default function TableResponsive({
  headers,
  data,
  strongId,
  onCheckboxClick,
  checkedItemIds,
}: TableProps) {
  return (
    <div className="px-4 sm:px-0">
      <div className="-mx-4 sm:-mx-0">
        <table className="min-w-full divide-y divide-gray-300">
          <thead>
            <tr>
              <th
                scope="col"
                className="hidden w-14 text-left text-sm font-semibold text-gray-900 sm:pl-0 sm:table-cell"
              />
              <th
                scope="col"
                className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-0"
              >
                {headers[0]}
              </th>
              <th
                scope="col"
                className="hidden px-3 py-3.5 text-left text-sm font-semibold text-gray-900 lg:table-cell"
              >
                {headers[1]}
              </th>
              <th
                scope="col"
                className="hidden px-3 py-3.5 text-left text-sm font-semibold text-gray-900 sm:table-cell"
              >
                {headers[2]}
              </th>
              <th
                scope="col"
                className="hidden px-3 py-3.5 text-left text-sm font-semibold text-gray-900 sm:table-cell"
              >
                {headers[3]}
              </th>
              {headers[4] && (
                <th scope="col" className="relative py-3.5 pl-3 pr-4 text-left sm:pr-0">
                  {headers[4]}
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white">
            {data.map(({ link, id, cols, isSynced }) => {
              // link = '/app/tableau-de-bord/caca';
              return (
                <Fragment key={id}>
                  <tr id={id} className="relative w-full">
                    <td className="hidden max-w-14 text-sm text-gray-500 lg:table-cell border-r border-r-gray-100">
                      <Checkbox
                        className="!m-0 [&_label]:before:!m-0"
                        options={[
                          {
                            label: '',
                            nativeInputProps: {
                              name: 'fiche',
                              value: id,
                              onChange: () => {
                                onCheckboxClick(id);
                              },
                              checked: checkedItemIds.includes(id),
                            },
                          },
                        ]}
                      />
                    </td>
                    <td className="w-full max-w-0 text-sm font-medium text-gray-900 sm:hidden">
                      <Link to={link} className="block bg-none py-4 pl-4 pr-3 !no-underline">
                        <dl className="font-normal lg:hidden">
                          <dt className="mt-2">{headers[0]}</dt>
                          <dd className="truncate text-gray-700">{cols[0]}</dd>
                          <dt className="mt-1 sm:hidden">{headers[1]}</dt>
                          <dd className="truncate text-gray-500 sm:hidden">{cols[1]}</dd>
                          <dt className="mt-1 sm:hidden">{headers[2]}</dt>
                          <dd className="truncate text-gray-500 sm:hidden">{cols[2]}</dd>
                          <dt className="mt-1 sm:hidden">{headers[3]}</dt>
                          <dd className="truncate text-gray-500 sm:hidden">{cols[3]}</dd>
                          <dt className="mt-1 sm:hidden">Numéro de fiche</dt>
                          <dd className="truncate text-gray-500 sm:hidden">{id}</dd>
                        </dl>
                      </Link>
                    </td>
                    <td className="hidden max-w-56 text-sm text-gray-500 lg:table-cell">
                      {!isSynced && (
                        <div className="absolute top-0 left-0 border-l-8 border-action-high-blue-france w-8 h-full"></div>
                      )}
                      <Link to={link} className="block bg-none !no-underline">
                        <span className="hidden lg:block">{cols[0]}</span>
                        <dl className="font-normal lg:hidden px-3 py-4">
                          <dt className="mt-2">{headers[1]}</dt>
                          <dd className="truncate text-gray-700">{cols[0]}</dd>
                          <dt className="mt-1 sm:hidden">{headers[2]}</dt>
                          <dd className="truncate text-gray-500 sm:hidden">{cols[1]}</dd>
                          <dt className="mt-1 sm:hidden">{headers[3]}</dt>
                          <dd className="truncate text-gray-500 sm:hidden">{cols[2]}</dd>
                        </dl>
                      </Link>
                    </td>
                    <td className="hidden text-sm text-gray-500 sm:table-cell">
                      <Link to={link} className="block bg-none px-3 py-4 !no-underline">
                        {cols[1]}
                      </Link>
                    </td>
                    <td className="hidden max-w-40 text-sm text-gray-500 sm:table-cell">
                      <Link to={link} className="block bg-none px-3 py-4 !no-underline">
                        {cols[2]}
                      </Link>
                    </td>
                    {headers[3] && (
                      <td className="flex h-full items-stretch justify-start text-left text-sm font-medium sm:table-cell sm:pr-0">
                        <Link
                          to={link}
                          className="flex h-full items-stretch bg-none py-4 pl-3 pr-4 !no-underline"
                        >
                          {cols[3]}
                        </Link>
                      </td>
                    )}
                  </tr>
                  <tr className="w-full border-b border-b-gray-300">
                    <td colSpan={1} className="text-sm text-gray-400 hidden sm:table-cell" />
                    <td
                      colSpan={cols.length - 1}
                      className={[
                        'text-sm hidden sm:table-cell',
                        strongId ? 'text-gray-900' : 'text-gray-200',
                      ].join(' ')}
                    >
                      <Link to={link} className="block bg-none !p-0 !m-0 !no-underline">
                        {id}
                      </Link>
                    </td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
