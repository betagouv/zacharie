import { NavLink, Outlet } from 'react-router';

const adminLinks = [
  { to: '/app/tableau-de-bord/admin/users', label: 'Utilisateurs' },
  { to: '/app/tableau-de-bord/admin/entities', label: 'Entités' },
  { to: '/app/tableau-de-bord/admin/api-keys', label: 'Clés API' },
];

export default function AdminLayout() {
  return (
    <>
      <div className="bg-white border-b border-gray-300">
        <div className="flex gap-0  px-4 text-sm fr-container">
          {adminLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              style={{ backgroundImage: 'none' }}
              className={({ isActive }) =>
                ` border-b-2 px-3 py-2 no-underline ${isActive
                  ? 'border-action-high-blue-france text-action-high-blue-france font-bold'
                  : 'border-transparent text-mention-grey hover:text-action-high-blue-france hover:border-action-high-blue-france'
                }`
              }
            >
              {link.label}
            </NavLink>
          ))}
          <a
            style={{ backgroundImage: 'none' }}
            href="https://metabase.zacharie.beta.gouv.fr/question/27-fiches-creees"
            target="_blank"
            className="border-b-2 border-transparent px-3 py-2 text-mention-grey no-underline hover:text-action-high-blue-france"
          >
            Fiches
          </a>
        </div>
      </div>
      <div className="fr-container">
        <Outlet />
      </div>
    </>
  );
}
