export default function ItemNotEditable({
  label,
  value,
  withDiscs = false,
}: {
  label: string;
  value: string | Array<string | null | undefined | React.ReactNode>;
  withDiscs?: boolean;
}) {
  return (
    <div className="mb-8 flex flex-col gap-2">
      <p className="font-bold">{label}</p>
      {Array.isArray(value) ? (
        value.length > 0 ? (
          <ul className={['ml-4 list-inside'].filter(Boolean).join(' ')}>
            {value.map((item, index) => {
              if (!item) return null;
              if (typeof item === 'string') {
                return (
                  <li key={item + index}>
                    <p className={['m-0 inline', withDiscs ? 'with-marker' : ''].join(' ')}>{item}</p>
                  </li>
                );
              }
              return <li key={index}>{item}</li>;
            })}
          </ul>
        ) : (
          <p className="ml-4">N/A</p>
        )
      ) : (
        <p className="ml-4">{value}</p>
      )}
    </div>
  );
}
