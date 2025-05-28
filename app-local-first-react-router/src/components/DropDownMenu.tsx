import { MainNavigation, MainNavigationProps } from '@codegouvfr/react-dsfr/MainNavigation';

interface DropDownMenuProps {
  isActive: boolean;
  text: string;
  menuLinks: MainNavigationProps.Item.Link[];
  className?: string;
}

export default function DropDownMenu({ isActive, text, menuLinks, className = '' }: DropDownMenuProps) {
  return (
    <MainNavigation
      // prettier-ignore
      className={["[&_.fr-nav\\_\\_item]:!bg-white [&_.fr-nav\\_\\_btn]:!py-0 [&_.fr-nav\\_\\_btn]:!min-h-10 [&_.fr-nav\\_\\_btn]:!text-action-high-blue-france [&_.fr-nav\\_\\_btn]:!font-medium [&_.fr-nav\\_\\_btn]:!text-base hidden lg:block", className].join(' ')}
      items={[
        {
          text,
          className: 'fr-btn--tertiary',
          isActive,
          menuLinks,
        },
      ]}
    />
  );
}
