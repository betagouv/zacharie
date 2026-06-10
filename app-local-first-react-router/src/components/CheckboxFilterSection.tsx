import CollapsibleSection from './CollapsibleSection';

interface CheckboxFilterOption {
  value: string;
  label: string;
}

interface CheckboxFilterSectionProps {
  title: string;
  options: CheckboxFilterOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  defaultOpen?: boolean;
  scroll?: boolean;
}

// Section de filtre à cases à cocher (multi-sélection), même design que la page « Mes fiches ».
export default function CheckboxFilterSection({
  title,
  options,
  selected,
  onChange,
  defaultOpen = true,
  scroll = false,
}: CheckboxFilterSectionProps) {
  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };
  return (
    <CollapsibleSection
      title={title}
      defaultOpen={defaultOpen}
      badge={
        selected.length > 0 ? (
          <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-xs text-blue-800">
            {selected.length}
          </span>
        ) : undefined
      }
    >
      <div className={`flex flex-col gap-1 ${scroll ? 'max-h-40 overflow-y-auto' : ''}`}>
        {options.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-gray-50"
          >
            <input
              type="checkbox"
              checked={selected.includes(option.value)}
              className="checked:accent-action-high-blue-france h-4 w-4 shrink-0"
              onChange={() => toggle(option.value)}
            />
            <span className="truncate text-sm">{option.label}</span>
          </label>
        ))}
      </div>
    </CollapsibleSection>
  );
}
