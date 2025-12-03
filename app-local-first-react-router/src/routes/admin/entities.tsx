import { Link } from 'react-router';
import { Table } from '@codegouvfr/react-dsfr/Table';
import { Button } from '@codegouvfr/react-dsfr/Button';
import dayjs from 'dayjs';
import type { AdminEntitiesResponse } from '@api/src/types/responses';
import { useEffect, useState } from 'react';
import Chargement from '@app/components/Chargement';
import Tabs, { TabsProps } from '@codegouvfr/react-dsfr/Tabs';
import { EntityTypes } from '@prisma/client';
import API from '@app/services/api';

export default function AdminEntites() {
  const [entities, setUsers] = useState<NonNullable<AdminEntitiesResponse['data']['entities']>>([]);

  const tabs: TabsProps['tabs'] = [
    {
      tabId: 'all',
      label: `Tous (${entities.length})`,
    },
    {
      tabId: EntityTypes.PREMIER_DETENTEUR,
      label: `Premier détenteur (${entities.filter((entity) => entity.type === EntityTypes.PREMIER_DETENTEUR).length})`,
    },
    {
      tabId: EntityTypes.COLLECTEUR_PRO,
      label: `Collecteur Pro (${entities.filter((entity) => entity.type === EntityTypes.COLLECTEUR_PRO).length})`,
    },
    {
      tabId: EntityTypes.ETG,
      label: `ETG (${entities.filter((entity) => entity.type === EntityTypes.ETG).length})`,
    },
    {
      tabId: EntityTypes.SVI,
      label: `SVI (${entities.filter((entity) => entity.type === EntityTypes.SVI).length})`,
    },
    {
      tabId: EntityTypes.CCG,
      label: `CCG (${entities.filter((entity) => entity.type === EntityTypes.CCG).length})`,
    },
  ];
  const [selectedTabId, setSelectedTabId] = useState(tabs[0].tabId);

  useEffect(() => {
    API.get({
      path: 'admin/entities',
    })
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
    <div className="fr-container--fluid fr-my-md-14v">
      <title>Entités | Admin | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire</title>
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
          <div className="fr-mb-2w flex items-center justify-between gap-4">
            <h1 className="fr-h2">Entités</h1>
            <Button
              linkProps={{
                to: '/app/tableau-de-bord/admin/add-entity',
              }}
            >
              +Ajouter des entités (SVI, ETG, etc.)
            </Button>
          </div>
          <section className="mb-6 bg-white md:shadow-sm">
            <Tabs
              selectedTabId={selectedTabId}
              tabs={tabs}
              onTabChange={setSelectedTabId}
              className="[&_.fr-tabs\_\_list]:bg-alt-blue-france! mb-6 bg-white md:shadow-sm [&_.fr-tabs\_\_list]:shadow-none!"
            >
              <div className="p-4 md:p-8 md:pb-0 [&_a]:block [&_a]:p-4 [&_a]:no-underline has-[a]:[&_td]:p-0!">
                <Table
                  fixed
                  noCaption
                  className="[&_td]:align-middle"
                  data={entities
                    .filter((entity) => {
                      if (selectedTabId === 'all') return true;
                      return entity.type === selectedTabId;
                    })
                    .map((entity, index) => [
                      <div
                        key={entity.id}
                        className="flex size-full flex-row items-start border-r border-r-gray-200"
                      >
                        <span className="p-4">{index + 1}</span>
                        <div>
                          <span className="text-sm text-gray-500">
                            Compatible Zacharie : {entity.zacharie_compatible ? '✅' : '❌'}
                          </span>
                          <Link
                            key={entity.id}
                            to={`/app/tableau-de-bord/admin/entity/${entity.id}`}
                            className="inline-flex! size-full items-start justify-start bg-none! no-underline!"
                            suppressHydrationWarning
                          >
                            {dayjs(entity.created_at).format('DD/MM/YYYY à HH:mm')}
                          </Link>
                        </div>
                      </div>,
                      <Link
                        key={entity.id}
                        to={`/app/tableau-de-bord/admin/entity/${entity.id}`}
                        className="no-scrollbar inline-flex! size-full items-start justify-start overflow-x-auto! border-r border-r-gray-200 bg-none! no-underline!"
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
                        className="no-scrollbar inline-flex! size-full items-start justify-start overflow-x-auto! border-r border-r-gray-200 bg-none! no-underline!"
                      >
                        {entity.type}
                      </Link>,
                    ])}
                  headers={['Date de création', 'Identité', 'Type']}
                />
              </div>
              <div className="flex flex-col items-start bg-white px-8 md:[&_ul]:min-w-96">
                <a className="fr-link fr-icon-arrow-up-fill fr-link--icon-left mb-4" href="#top">
                  Haut de page
                </a>
              </div>
            </Tabs>
          </section>
        </div>
      </div>
    </div>
  );
}
