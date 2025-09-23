import type { UserConnexionResponse } from '@api/src/types/responses';
// import useUser from '@app/zustand/user';
import { useEffect, useState } from 'react';
import API from '@app/services/api';
import useZustandStore from '@app/zustand/store';
import useUser from '@app/zustand/user';
import SelectCustom from '@app/components/SelectCustom';
import { ApiKeyApprovalStatus, ApiKeyScope, Entity, User } from '@prisma/client';
import { Highlight } from '@codegouvfr/react-dsfr/Highlight';
import { Link } from 'react-router';

export default function PartageDeMesDonnees() {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const accessToPersonalAccount = apiKeyApprovals.filter((approval) => !!approval.user_id);
  const accessToEntities = apiKeyApprovals.filter(
    (approval) => !!approval.entity_id && !approval.ApiKey.dedicated_to_entity_id,
  );
  const dedicatedToMyEntities = apiKeyApprovals.filter(
    (approval) => !!approval.ApiKey.dedicated_to_entity_id,
  );

  return (
    <div className="fr-container fr-container--fluid fr-my-md-14v">
      <title>
        Partage de mes données | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire
      </title>
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
          <h1 className="fr-h2 fr-mb-2w">Partage des mes données</h1>

          {dedicatedToMyEntities.length > 0 && (
            <div className="mb-6 bg-white md:shadow-sm">
              <div className="p-4 md:p-8">
                <h3 className="text-lg font-semibold text-gray-900">
                  <span>Votre clé dédiée</span>
                </h3>
                <Highlight
                  className="mb-8"
                  classes={{
                    root: 'fr-highlight--green-emeraude',
                  }}
                >
                  La documentation pour l'utilisation de l'API est disponible{' '}
                  <a href={`https://${import.meta.env.VITE_API_URL}/v1/docs/cle-dediee`} target="_blank">
                    ici
                  </a>
                  .<br />
                  <br />
                  Si vous êtes vous-même éditeur de logiciel et que vous avez besoin de la valeur de votre clé
                  privée, veuillez nous <Link to="/contact">contacter</Link>.<br />
                  Si vous pensez que votre clé est compromise, veuillez la révoquer ci-dessous et nous{' '}
                  <Link to="/contact">contacter</Link> pour la régénérer.
                </Highlight>
                {dedicatedToMyEntities.map((approval) => {
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
              </div>
            </div>
          )}
          {accessToPersonalAccount.length > 0 && (
            <div className="mb-6 bg-white md:shadow-sm">
              <div className="p-4 md:p-8">
                <h3 className="text-lg font-semibold text-gray-900">
                  <span>Accès à votre compte personnel</span>
                </h3>
                <Highlight
                  className="mb-8"
                  classes={{
                    root: 'fr-highlight--green-emeraude',
                  }}
                >
                  Certains éditeurs de logiciels souhaitent accéder à vos données Zacharie pour vous proposer
                  des services via leur application. Vous pouvez gérer les autorisations ci-dessous.
                </Highlight>
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
              </div>
            </div>
          )}
          {accessToEntities.length > 0 && (
            <div className="mb-6 bg-white md:shadow-sm">
              <div className="p-4 md:p-8">
                <h3 className="text-lg font-semibold text-gray-900">
                  <span>Accès à vos entités (CCG, Collecteur Pro, ETG, SVI)</span>
                </h3>
                <Highlight
                  className="mb-8"
                  classes={{
                    root: 'fr-highlight--green-emeraude',
                  }}
                >
                  Certains éditeurs de logiciels souhaitent accéder à vos données Zacharie pour vous proposer
                  des services via leur application. Vous pouvez gérer les autorisations ci-dessous.
                </Highlight>
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
