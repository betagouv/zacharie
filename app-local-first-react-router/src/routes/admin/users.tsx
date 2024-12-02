import { Fragment, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Table } from '@codegouvfr/react-dsfr/Table';
import dayjs from 'dayjs';
import type { AdminUsersResponse } from '@api/src/types/responses';
import Chargement from '@app/components/Chargement';
import { clearCache } from '@app/services/indexed-db';

export default function AdminUsers() {
  const [users, setUsers] = useState<NonNullable<AdminUsersResponse['data']['users']>>([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/admin/users`, {
      method: 'GET',
      credentials: 'include',
      headers: new Headers({
        Accept: 'application/json',
        'Content-Type': 'application/json',
      }),
    })
      .then((res) => res.json())
      .then((res) => res as AdminUsersResponse)
      .then((res) => {
        if (res.ok) {
          setUsers(res.data.users);
        }
      });
  }, []);

  if (!users?.length) {
    return <Chargement />;
  }

  return (
    <div className="fr-container fr-container--fluid fr-my-md-14v">
      <title>Utilisateurs | Admin | Zacharie | Ministère de l'Agriculture</title>
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
          <h1 className="fr-h2 fr-mb-2w">Utilisateurs</h1>
          <section className="mb-6 bg-white md:shadow">
            <div className="p-4 md:p-8 md:pb-0 [&_a]:block [&_a]:p-4 [&_a]:no-underline [&_td]:has-[a]:!p-0">
              <Table
                fixed
                noCaption
                className="[&_td]:h-px"
                headers={['Dates', 'Identité', 'Roles', 'Actions']}
                data={users.map((user, index) => [
                  <div key={user.id} className="flex size-full flex-row items-start">
                    <span className="p-4">{index + 1}</span>
                    <Link
                      to={`/app/tableau-de-bord/admin/user/${user.id}`}
                      className="!inline-flex size-full items-start justify-start !bg-none !no-underline"
                      suppressHydrationWarning
                    >
                      Compte activé: {user.activated ? '✅' : '❌'}
                      <br />
                      Création: {dayjs(user.created_at).format('DD/MM/YYYY à HH:mm')}
                      <br />
                      Fin d'onboarding: {dayjs(user.onboarded_at).format('DD/MM/YYYY à HH:mm')}
                    </Link>
                  </div>,
                  <Link
                    key={user.id}
                    to={`/app/tableau-de-bord/admin/user/${user.id}`}
                    className="!inline-flex size-full items-start justify-start !bg-none !no-underline"
                  >
                    {user.prenom} {user.nom_de_famille}
                    <br />＠ {user.email}
                    <br />
                    ☎️ {user.telephone}
                    <br />
                    🏡 {user.addresse_ligne_1}
                    <br />
                    {user.addresse_ligne_2 && (
                      <>
                        <br />
                        {user.addresse_ligne_2}
                      </>
                    )}
                    {user.code_postal} {user.ville}
                  </Link>,
                  <Link
                    key={user.id}
                    to={`/app/tableau-de-bord/admin/user/${user.id}`}
                    className="!inline-flex size-full items-start justify-start !bg-none !no-underline"
                  >
                    {user.roles.map((role) => (
                      <Fragment key={role}>
                        {role}
                        <br />
                      </Fragment>
                    ))}
                  </Link>,
                  <form
                    key={user.email}
                    method="POST"
                    onSubmit={(event) => {
                      event.preventDefault();

                      fetch(`${import.meta.env.VITE_API_URL}/admin/user/connect-as`, {
                        method: 'POST',
                        credentials: 'include',
                        body: JSON.stringify({
                          email: user.email!,
                        }),
                        headers: new Headers({
                          Accept: 'application/json',
                          'Content-Type': 'application/json',
                        }),
                      })
                        .then(() => {
                          window.localStorage.clear();
                        })
                        .then(() => {
                          navigate('/app/tableau-de-bord');
                        });
                    }}
                  >
                    <button type="submit" className="fr-btn fr-btn--secondary fr-btn--sm">
                      Se connecter en tant que {user.email}
                    </button>
                    ,
                  </form>,
                ])}
              />
            </div>
            <div className="flex flex-col items-start bg-white px-8 [&_ul]:md:min-w-96">
              <a className="fr-link fr-icon-arrow-up-fill fr-link--icon-left mb-4" href="#top">
                Haut de page
              </a>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
