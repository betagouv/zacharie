import { useState, type ReactNode } from 'react';

interface CollapsibleSectionProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  badge?: ReactNode;
}

export default function CollapsibleSection({
  title,
  children,
  defaultOpen = true,
  badge,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-gray-200 py-2">
      <button
        type="button"
        className="flex w-full items-center justify-between py-1 text-left text-sm font-bold text-gray-800"
        onClick={() => setOpen(!open)}
      >
        <span className="flex items-center gap-2">
          {title}
          {badge}
        </span>
        <span
          className={`fr-icon--sm transition-transform ${open ? 'fr-icon-arrow-up-s-line' : 'fr-icon-arrow-down-s-line'}`}
          aria-hidden="true"
        />
      </button>
      {open && <div className="pt-2">{children}</div>}
    </div>
  );
}
