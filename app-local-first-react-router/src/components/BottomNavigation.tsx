import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router';
import type { MainNavigationProps } from '@codegouvfr/react-dsfr/MainNavigation';

const MAX_VISIBLE_ITEMS = 4;

type NavItem = MainNavigationProps.Item;

function getIcon(text: string): string {
  const lowerText = text.toLowerCase();
  if (lowerText === 'nouvelle fiche') return 'ri-add-circle-line';
  if (lowerText === 'tableau de bord') return 'ri-dashboard-3-line';
  if (lowerText === 'fiches') return 'ri-file-list-line';
  if (lowerText === 'carcasses') return 'ri-archive-line';
  if (lowerText === 'mon profil') return 'ri-user-line';
  if (lowerText === 'mon activité') return 'ri-user-line';
  if (lowerText === 'mes coordonnées') return 'ri-map-pin-line';
  if (lowerText === 'mes informations de chasse') return 'ri-user-line';
  if (lowerText === 'mes centres de collecte') return 'ri-map-pin-line';
  if (lowerText === 'mes notifications') return 'ri-notification-line';
  if (lowerText === 'partage de mes données') return 'ri-share-line';
  if (lowerText === 'informations') return 'ri-information-line';
  if (lowerText === 'ajouter un utilisateur') return 'ri-user-add-line';
  if (lowerText.startsWith('mon entreprise') || lowerText.startsWith('mon service'))
    return 'ri-building-line';
  if (lowerText === 'admin') return 'ri-admin-line';
  if (lowerText.startsWith('liste des')) return 'ri-list-check';
  if (lowerText === 'contact') return 'ri-mail-line';
  return 'ri-menu-line';
}

function getShortLabel(text: string): string {
  const lowerText = text.toLowerCase();
  if (lowerText === 'nouvelle fiche') return 'Nouvelle fiche';
  if (lowerText === 'tableau de bord') return 'Tableau de bord';
  if (lowerText === 'mon profil') return 'Profil';
  if (lowerText === 'mes informations de chasse') return 'Mes infos';
  if (lowerText.startsWith('mon entreprise')) return 'Entreprise';
  if (lowerText.startsWith('mon service')) return 'Service';
  return text;
}

function getItemLink(item: NavItem): string | null {
  if ('menuLinks' in item && item.menuLinks) {
    const firstLink = (item.menuLinks as NavItem[])[0];
    if (firstLink && 'linkProps' in firstLink && firstLink.linkProps) {
      return (firstLink.linkProps as { to?: string }).to ?? null;
    }
    return null;
  }
  if ('linkProps' in item && item.linkProps) {
    return (item.linkProps as { to?: string }).to ?? null;
  }
  return null;
}

function getItemOnClick(item: NavItem): (() => void) | null {
  if ('linkProps' in item && item.linkProps && 'onClick' in item.linkProps) {
    return item.linkProps.onClick as () => void;
  }
  return null;
}

function getTextString(item: NavItem): string {
  return typeof item.text === 'string' ? item.text : String(item.text ?? '');
}

function NavButton({
  item,
  isOverflow,
}: {
  item: NavItem;
  isOverflow?: boolean;
}) {
  const text = getTextString(item);
  const isActive = 'isActive' in item ? item.isActive : false;
  const icon = getIcon(text);
  const label = getShortLabel(text);
  const to = getItemLink(item);
  const onClick = getItemOnClick(item);

  const activeClass = isActive ? 'text-action-high-blue-france' : 'text-mention-grey';

  if (isOverflow) {
    if (onClick && !to) {
      return (
        <button
          type="button"
          onClick={onClick}
          className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-gray-100 ${isActive ? 'text-action-high-blue-france font-bold' : 'text-mention-grey'
            }`}
        >
          <i className={`${icon} text-lg`} />
          <span>{text}</span>
        </button>
      );
    }
    if (to) {
      return (
        <Link
          to={to}
          className={`flex w-full items-center gap-3 px-4 py-3 text-sm no-underline hover:bg-gray-100 ${isActive ? 'text-action-high-blue-france font-bold' : 'text-mention-grey'
            }`}
        >
          <i className={`${icon} text-lg`} />
          <span>{text}</span>
        </Link>
      );
    }
    return null;
  }

  // "Nouvelle fiche" has onClick only, no `to`
  if (onClick && !to) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 ${activeClass}`}
      >
        <i className={`${icon} text-xl`} />
        <span className="truncate text-[10px] leading-tight">{label}</span>
      </button>
    );
  }

  if (to) {
    return (
      <Link
        to={to}
        className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 no-underline ${activeClass}`}
      >
        <i className={`${icon} text-xl`} />
        <span className="truncate text-[10px] leading-tight">{label}</span>
      </Link>
    );
  }

  return null;
}

function flattenItems(items: NavItem[]): NavItem[] {
  const result: NavItem[] = [];
  for (const item of items) {
    if ('menuLinks' in item && item.menuLinks) {
      for (const subItem of item.menuLinks as NavItem[]) {
        result.push(subItem);
      }
    } else {
      result.push(item);
    }
  }
  return result;
}

export default function BottomNavigation({ items }: { items: MainNavigationProps.Item[] }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    if (moreOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [moreOpen]);

  if (items.length === 0) return null;

  const flatItems = flattenItems(items);
  const needsOverflow = flatItems.length > MAX_VISIBLE_ITEMS;
  const visibleItems = needsOverflow ? flatItems.slice(0, MAX_VISIBLE_ITEMS - 1) : flatItems;
  const overflowItems = needsOverflow ? flatItems.slice(MAX_VISIBLE_ITEMS - 1) : [];
  const overflowHasActive = overflowItems.some((item) => 'isActive' in item && item.isActive);

  return (
    <nav
      className="fixed right-0 bottom-0 left-0 z-[60] flex h-16 items-stretch border-t border-gray-200 bg-white md:hidden"
      aria-label="Navigation mobile"
    >
      {visibleItems.map((item, i) => (
        <NavButton key={getTextString(item) || i} item={item} />
      ))}
      {needsOverflow && (
        <div ref={moreRef} className="relative flex min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setMoreOpen((prev) => !prev)}
            className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 ${overflowHasActive ? 'text-action-high-blue-france' : 'text-mention-grey'
              }`}
            aria-expanded={moreOpen}
            aria-haspopup="true"
          >
            <i className="ri-more-line text-xl" />
            <span className="truncate text-[10px] leading-tight">Plus</span>
          </button>
          {moreOpen && (
            <div className="absolute right-0 bottom-full mb-1 min-w-48 rounded-t-lg border border-gray-200 bg-white shadow-lg">
              {overflowItems.map((item, i) => (
                <div key={getTextString(item) || i} onClick={() => setMoreOpen(false)}>
                  <NavButton item={item} isOverflow />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
