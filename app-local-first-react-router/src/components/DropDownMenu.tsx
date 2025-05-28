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
      className={["drop-down", "hidden lg:block", className].join(' ')}
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
