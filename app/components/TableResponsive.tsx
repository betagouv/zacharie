import { Link } from "@remix-run/react";

type TableProps = {
  caption?: string;
  headers: string[];
  data: Array<{ link: string; id: string; rows: string[] }>;
  bordered?: boolean;
  className?: string;
};

export default function TableResponsive({ headers, data }: TableProps) {
  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="-mx-4 sm:-mx-0">
        <table className="min-w-full divide-y divide-gray-300">
          <thead>
            <tr>
              <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-0">
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
              <th scope="col" className="relative py-3.5 pl-3 pr-4 text-left sm:pr-0">
                {headers[4]}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {data.map(({ link, id, rows }) => {
              return (
                <tr key={id}>
                  <td className="w-full max-w-0 py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:w-auto sm:max-w-none sm:pl-0">
                    <Link to={link} className="bg-none !no-underline">
                      {rows[0]}
                      <dl className="font-normal lg:hidden">
                        <dt className="mt-2">{headers[1]}</dt>
                        <dd className="truncate text-gray-700">{rows[1]}</dd>
                        <dt className="mt-1 sm:hidden">{headers[2]}</dt>
                        <dd className="truncate text-gray-500 sm:hidden">{rows[2]}</dd>
                        <dt className="mt-1 sm:hidden">{headers[3]}</dt>
                        <dd className="truncate text-gray-500 sm:hidden">{rows[3]}</dd>
                      </dl>
                    </Link>
                  </td>
                  <td className="hidden px-3 py-4 text-sm text-gray-500 lg:table-cell">{rows[1]}</td>
                  <td className="hidden px-3 py-4 text-sm text-gray-500 sm:table-cell">{rows[2]}</td>
                  <td className="hidden px-3 py-4 text-sm text-gray-500 sm:table-cell">{rows[3]}</td>
                  <td className="py-4 pl-3 pr-4 text-left text-sm font-medium sm:pr-0">{rows[4]}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}