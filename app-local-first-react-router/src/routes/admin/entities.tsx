import { Link } from 'react-router';
import { Table } from '@codegouvfr/react-dsfr/Table';
import dayjs from 'dayjs';
import type { AdminEntitiesResponse } from '@api/src/types/responses';
import { useEffect, useState } from 'react';
import Chargement from '@app/components/Chargement';

export default function AdminEntites() {
  const [entities, setUsers] = useState<NonNullable<AdminEntitiesResponse['data']['entities']>>([]);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/admin/entities`, {
      method: 'GET',
      credentials: 'include',
      headers: new Headers({
        Accept: 'application/json',
        'Content-Type': 'application/json',
      }),
    })
      .then((res) => res.json())
      .then((res) => res as AdminEntitiesResponse)
      .then((res) => {
        if (res.ok) {
          setUsers(res.data.entities);
        }
      });
  }, []);

  if (!entities?.length) {
    return <Chargement />;
  }

  return (
    <div className="fr-container fr-container--fluid fr-my-md-14v">
      <title>Entités | Admin | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire</title>
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
          <h1 className="fr-h2 fr-mb-2w">Entités</h1>
          <section className="mb-6 bg-white md:shadow">
            <div className="p-4 md:p-8 md:pb-0 [&_a]:block [&_a]:p-4 [&_a]:no-underline [&_td]:has-[a]:!p-0">
              <Table
                fixed
                noCaption
                className="[&_td]:h-px"
                data={entities.map((entity, index) => [
                  <div key={entity.id} className="flex size-full flex-row items-start">
                    <span className="p-4">{index + 1}</span>
                    <Link
                      key={entity.id}
                      to={`/app/tableau-de-bord/admin/entity/${entity.id}`}
                      className="!inline-flex size-full items-start justify-start !bg-none !no-underline"
                      suppressHydrationWarning
                    >
                      {dayjs(entity.created_at).format('DD/MM/YYYY à HH:mm')}
                    </Link>
                  </div>,
                  <Link
                    key={entity.id}
                    to={`/app/tableau-de-bord/admin/entity/${entity.id}`}
                    className="!inline-flex size-full items-start justify-start !bg-none !no-underline"
                  >
                    {entity.nom_d_usage}
                    <br />
                    🏭 {entity.numero_ddecpp}
                    <br />
                    🏡 {entity.address_ligne_1}
                    <br />
                    {entity.address_ligne_2 && (
                      <>
                        <br />
                        {entity.address_ligne_2}
                      </>
                    )}
                    {entity.code_postal} {entity.ville}
                  </Link>,
                  <Link
                    key={entity.id}
                    to={`/app/tableau-de-bord/admin/entity/${entity.id}`}
                    className="!inline-flex size-full items-start justify-start !bg-none !no-underline"
                  >
                    {entity.type}
                  </Link>,
                ])}
                headers={['Date de création', 'Identité', 'Type']}
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
