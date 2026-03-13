import { Outlet, useLocation } from 'react-router';
import { SideMenu } from '@codegouvfr/react-dsfr/SideMenu';

const adminLinks = [
  { to: '/app/tableau-de-bord/admin/dashboard', label: 'Tableau de bord' },
  { to: '/app/tableau-de-bord/admin/users', label: 'Utilisateurs' },
  { to: '/app/tableau-de-bord/admin/entities', label: 'Entités' },
  { to: '/app/tableau-de-bord/admin/import-ccg', label: 'Import CCG' },
  { to: '/app/tableau-de-bord/admin/api-keys', label: 'Clés API' },
  { to: '/app/tableau-de-bord/admin/carcasses-intermediaires', label: 'Carcasses Inter.' },
];

export default function AdminLayout() {
  const location = useLocation();

  return (
    <div className="px-2 flex min-h-[calc(100vh-200px)]">
      <div className="bg-white border-r border-gray-200 w-56 shrink-0 pt-4 [&_.fr-sidemenu\_\_inner]:shadow-none!">
        <SideMenu
          align="left"
          burgerMenuButtonText="Menu admin"
          items={[
            ...adminLinks.map((link) => ({
              isActive: location.pathname.startsWith(link.to),
              linkProps: {
                href: link.to,
                to: link.to,
              },
              text: link.label,
            })),
            {
              isActive: false,
              linkProps: {
                href: 'https://metabase.zacharie.beta.gouv.fr/question/27-fiches-creees',
                target: '_blank' as const,
              },
              text: 'Fiches ↗',
            },
          ]}
        />
      </div>
      <main className="fr-container min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}
