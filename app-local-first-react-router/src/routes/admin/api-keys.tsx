import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Table } from '@codegouvfr/react-dsfr/Table';
import dayjs from 'dayjs';
import type { AdminApiKeysResponse } from '@api/src/types/responses';
import Chargement from '@app/components/Chargement';
import { Tabs, type TabsProps } from '@codegouvfr/react-dsfr/Tabs';
import API from '@app/services/api';

export default function AdminApiKeys() {
  const [apiKeys, setApiKeys] = useState<NonNullable<AdminApiKeysResponse['data']['apiKeys']>>([]);
  const tabs: TabsProps['tabs'] = [
    {
      tabId: 'all',
      label: `Toutes (${apiKeys.length})`,
    },
    {
      tabId: 'activated',
      label: `Activées (${apiKeys.filter((apiKey) => apiKey.active).length})`,
    },
    {
      tabId: 'deactivated',
      label: `Désactivées (${apiKeys.filter((apiKey) => !apiKey.active).length})`,
    },
  ];
  const [selectedTabId, setSelectedTabId] = useState(tabs[0].tabId);

  useEffect(() => {
    API.get({ path: 'admin/api-keys' })
      .then((res) => res as AdminApiKeysResponse)
      .then((res) => {
        if (res.ok) {
          setApiKeys(res.data.apiKeys);
        }
      });
  }, []);

  if (!apiKeys?.length) {
    return <Chargement />;
  }

  return (
    <div className="fr-container fr-container--fluid fr-my-md-14v">
      <title>
        Clés API | Admin | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire
      </title>
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
          <h1 className="fr-h2 fr-mb-2w">Clés API</h1>
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
                  className="[&_td]:h-px"
                  headers={['Dates', 'Identité', 'Scopes', 'Approbations']}
                  data={apiKeys
                    .filter((apiKey) => {
                      if (selectedTabId === 'activated') {
                        return apiKey.active;
                      }
                      if (selectedTabId === 'deactivated') {
                        return !apiKey.active;
                      }
                      return true;
                    })
                    .map((apiKey, index) => [
                      <div key={apiKey.id} className="flex size-full flex-row items-start">
                        <span className="p-4">{index + 1}</span>
                        <Link
                          to={`/app/tableau-de-bord/admin/api-key/${apiKey.id}`}
                          className="inline-flex! size-full items-start justify-start bg-none! no-underline!"
                          suppressHydrationWarning
                        >
                          Clé activée: {apiKey.active ? '✅' : '❌'}
                          <br />
                          Création: {dayjs(apiKey.created_at).format('DD/MM/YYYY à HH:mm')}
                        </Link>
                      </div>,
                      <Link
                        key={apiKey.id}
                        to={`/app/tableau-de-bord/admin/api-key/${apiKey.id}`}
                        className="inline-flex! size-full items-start justify-start bg-none! no-underline!"
                      >
                        {apiKey.name}
                        <br />＠ {apiKey.description}
                      </Link>,
                      <Link
                        key={apiKey.id}
                        to={`/app/tableau-de-bord/admin/api-key/${apiKey.id}`}
                        className="inline-flex! size-full items-start justify-start bg-none! no-underline!"
                      >
                        {apiKey.scopes.join(', ')}
                      </Link>,
                      <div
                        key={apiKey.id}
                        className="inline-flex! size-full items-start justify-start bg-none! no-underline!"
                      >
                        {apiKey.approvals.map((approval) => {
                          if (approval.User) {
                            return (
                              <Link
                                to={`/app/tableau-de-bord/admin/user/${approval.User.id}`}
                                key={approval.id}
                              >
                                {approval.User.email} ({approval.User.roles.join(', ')})
                                <br />
                              </Link>
                            );
                          }
                          if (approval.Entity) {
                            return (
                              <Link
                                to={`/app/tableau-de-bord/admin/entity/${approval.Entity.id}`}
                                key={approval.id}
                              >
                                {approval.Entity.nom_d_usage} ({approval.Entity.type})
                                <br />
                              </Link>
                            );
                          }
                          return null;
                        })}
                      </div>,
                    ])}
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
