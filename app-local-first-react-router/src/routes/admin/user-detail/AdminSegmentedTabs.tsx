export type AdminTabItem = { id: string; label: string };

type AdminSegmentedTabsProps = {
  tabs: AdminTabItem[];
  value: string;
  onChange: (id: string) => void;
  ariaLabel: string;
  className?: string;
  variant?: 'default' | 'compact';
};

export default function AdminSegmentedTabs({
  tabs,
  value,
  onChange,
  ariaLabel,
  className = '',
  variant = 'default',
}: AdminSegmentedTabsProps) {
  const btn =
    variant === 'compact'
      ? 'px-2.5 py-1 text-xs font-medium rounded-md transition-colors'
      : 'px-3 py-1.5 text-sm font-medium rounded-md transition-colors';

  return (
    <nav className={`${className} max-w-full`} role="tablist" aria-label={ariaLabel}>
      <div className="inline-flex max-w-full flex-wrap gap-0.5 rounded-lg border border-gray-200/90 bg-[#eceef3] p-0.5">
        {tabs.map((tab) => {
          const selected = value === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              className={`${btn} ${
                selected
                  ? 'border border-gray-200/80 bg-white text-[#161616] shadow-sm'
                  : 'border border-transparent bg-transparent text-[#666] hover:bg-white/70 hover:text-[#161616]'
              }`}
              onClick={() => onChange(tab.id)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
