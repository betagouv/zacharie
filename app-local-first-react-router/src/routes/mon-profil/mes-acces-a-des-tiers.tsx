import type { UserConnexionResponse } from '@api/src/types/responses';
// import useUser from '@app/zustand/user';
import { useEffect, useState } from 'react';
import API from '@app/services/api';
import useZustandStore from '@app/zustand/store';
import useUser from '@app/zustand/user';
import SelectCustom from '@app/components/SelectCustom';
import { ApiKeyApprovalStatus, ApiKeyScope, Entity, User } from '@prisma/client';
import Button from '@codegouvfr/react-dsfr/Button';

export default function MesAccesATiers() {
  const apiKeyApprovals = useZustandStore((state) => state.apiKeyApprovals);
  const setApiKeyApprovals = useZustandStore((state) => state.setApiKeyApprovals);
  const entities = useZustandStore((state) => state.entities);
  const user = useUser((state) => state.user)!;

  function refreshApiApprovals() {
    API.get({ path: 'user/me' })
      .then((res) => res as UserConnexionResponse)
      .then((res) => {
        if (res.ok) {
          setApiKeyApprovals(res.data.apiKeyApprovals || []);
        }
      });
  }

  useEffect(() => {
    window.scrollTo(0, 0);
    refreshApiApprovals();
  }, []);

  const accessToPersonalAccount = apiKeyApprovals.filter((approval) => !!approval.user_id);
  const accessToEntities = apiKeyApprovals.filter((approval) => !!approval.entity_id);

  console.log(apiKeyApprovals);

  return (
    <div className="fr-container fr-container--fluid fr-my-md-14v">
      <title>
        Mes Accès à des tiers | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire
      </title>
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
          <h1 className="fr-h2 fr-mb-2w">
            Gérez les autorisations de tierces parties à accéder à votre compte Zacharie
          </h1>
          {accessToPersonalAccount.length > 0 && (
            <div className="mb-6 bg-white md:shadow-sm">
              <div className="p-4 md:p-8">
                <h3 className="text-lg font-semibold text-gray-900">
                  <span>Accès à votre compte personnel</span>
                </h3>
                {accessToPersonalAccount.map((approval) => {
                  if (approval.user_id !== user.id) {
                    return null;
                  }
                  return (
                    <div
                      key={approval.id && approval.status}
                      className={[
                        'flex basis-full flex-row items-center justify-between border-solid text-left',
                        'bg-contrast-grey mb-2 border-0',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      <div className="flex flex-1 flex-col border-none p-4 text-left">
                        <p className="inline-flex! size-full items-center justify-start bg-none! text-lg font-bold no-underline!">
                          {approval.ApiKey.name}
                        </p>
                        <p className="ml-4 inline-flex! size-full items-center justify-start bg-none! font-bold no-underline!">
                          {approval.ApiKey.description}
                        </p>
                        <ul className="list-inside list-disc">
                          Autorisations:{' '}
                          {approval.ApiKey.scopes.map((scope) => {
                            switch (scope) {
                              case ApiKeyScope.FEI_READ_FOR_USER:
                                return <li>Lire des fiches au nom d'un utilisateur</li>;
                              case ApiKeyScope.FEI_READ_FOR_ENTITY:
                                return <li>Lire des fiches au nom d'une entité</li>;
                              case ApiKeyScope.CARCASSE_READ_FOR_USER:
                                return <li>Lire des carcasses au nom d'un utilisateur</li>;
                              case ApiKeyScope.CARCASSE_READ_FOR_ENTITY:
                                return <li>Lire des carcasses au nom d'une entité</li>;
                              default:
                                return null;
                            }
                          })}
                        </ul>
                      </div>
                      <div className="flex flex-row gap-2 pr-4">
                        <div className="flex shrink-0 flex-col justify-center gap-2 py-4">
                          <ApprovalStatusSelector
                            user={user}
                            approval={approval}
                            refreshApiApprovals={refreshApiApprovals}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div className="mt-6 mb-16 ml-6">
                  <a className="fr-link fr-icon-arrow-up-fill fr-link--icon-left" href="#top">
                    Haut de page
                  </a>
                </div>
              </div>
            </div>
          )}
          {accessToEntities.length > 0 && (
            <div className="mb-6 bg-white md:shadow-sm">
              <div className="p-4 md:p-8">
                <h3 className="text-lg font-semibold text-gray-900">
                  <span>Accès à vos entités (CCG, Collecteur Pro, ETG, SVI)</span>
                </h3>
                {accessToEntities.map((approval) => {
                  const entity = entities[approval.entity_id!];
                  if (!entity) {
                    return null;
                  }
                  return (
                    <div
                      key={approval.id && approval.status}
                      className={[
                        'flex basis-full flex-row items-center justify-between border-solid text-left',
                        'bg-contrast-grey mb-2 border-0',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      <div className="flex flex-1 flex-col border-none p-4 text-left">
                        <p className="inline-flex! size-full items-center justify-start bg-none! font-bold no-underline!">
                          {approval.ApiKey.name}
                          <br />
                          {approval.ApiKey.description}
                          <br />
                        </p>
                        <ul className="list-inside list-disc">
                          Autorisations:{' '}
                          {approval.ApiKey.scopes.map((scope) => {
                            switch (scope) {
                              case ApiKeyScope.FEI_READ_FOR_USER:
                                return <li>Lire des fiches au nom d'un utilisateur</li>;
                              case ApiKeyScope.FEI_READ_FOR_ENTITY:
                                return <li>Lire des fiches au nom d'une entité</li>;
                              case ApiKeyScope.CARCASSE_READ_FOR_USER:
                                return <li>Lire des carcasses au nom d'un utilisateur</li>;
                              case ApiKeyScope.CARCASSE_READ_FOR_ENTITY:
                                return <li>Lire des carcasses au nom d'une entité</li>;
                              default:
                                return null;
                            }
                          })}
                        </ul>
                      </div>
                      <div className="flex flex-row gap-2 pr-4">
                        <div className="flex shrink-0 flex-col justify-center gap-2 py-4">
                          <ApprovalStatusSelector
                            entity={entity}
                            approval={approval}
                            refreshApiApprovals={refreshApiApprovals}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div className="mt-6 mb-16 ml-6">
                  <a className="fr-link fr-icon-arrow-up-fill fr-link--icon-left" href="#top">
                    Haut de page
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const approvalStatusOptions: Array<{
  label: string;
  value: Approval['status'];
}> = [
  {
    label: 'Je donne mon accord',
    value: ApiKeyApprovalStatus.APPROVED,
  },
  {
    label: 'En attente de mon accord',
    value: ApiKeyApprovalStatus.PENDING,
  },
  {
    label: 'Je ne donne pas mon accord',
    value: ApiKeyApprovalStatus.REJECTED,
  },
];

type Approval = NonNullable<UserConnexionResponse['data']['apiKeyApprovals']>[number];

function ApprovalStatusSelector({
  approval,
  entity,
  user,
  refreshApiApprovals,
}: {
  approval: Approval;
  entity?: Entity;
  user?: User;
  refreshApiApprovals: () => void;
}) {
  const [status, setStatus] = useState<Approval['status']>(approval?.status);
  return (
    <SelectCustom
      options={approvalStatusOptions}
      getOptionLabel={(f) => f.label!}
      getOptionValue={(f) => f.value}
      onChange={(f) => {
        const newStatus = f?.value;
        API.post({
          path: `api-key-approval/${approval.id}`,
          body: {
            api_key_id: approval.api_key_id,
            entity_id: entity?.id,
            user_id: user?.id,
            status: newStatus,
          },
        }).then((res) => {
          if (res.ok) {
            setStatus(newStatus!);
            refreshApiApprovals();
          }
        });
      }}
      className="w-full bg-white"
      value={approvalStatusOptions.find((opt) => opt.value === status)}
    />
  );
}
