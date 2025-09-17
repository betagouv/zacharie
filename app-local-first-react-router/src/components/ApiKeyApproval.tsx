import { useState, type RefObject, useRef, useEffect, Fragment } from 'react';
import { ButtonsGroup } from '@codegouvfr/react-dsfr/ButtonsGroup';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { Prisma, ApiKeyScope, ApiKeyApprovalStatus, Entity, User } from '@prisma/client';
import { RadioButtons } from '@codegouvfr/react-dsfr/RadioButtons';
import { Tabs, type TabsProps } from '@codegouvfr/react-dsfr/Tabs';
import { Table } from '@codegouvfr/react-dsfr/Table';
import type { AdminApiKeyAndApprovalsResponse } from '@api/src/types/responses';
import { Link, useParams } from 'react-router';
import Chargement from '@app/components/Chargement';
import API from '@app/services/api';
import Checkbox from '@codegouvfr/react-dsfr/Checkbox';
import { Highlight } from '@codegouvfr/react-dsfr/Highlight';
import SelectCustom from '@app/components/SelectCustom';

const loadData = (apiKeyId: string): Promise<AdminApiKeyAndApprovalsResponse> =>
  API.get({ path: `admin/api-key/${apiKeyId}` }).then((res) => res as AdminApiKeyAndApprovalsResponse);

type Approval = NonNullable<AdminApiKeyAndApprovalsResponse['data']>['apiKey']['approvals'][number];

interface EntitiesRelatedToProps {
  approval: Approval;
  apiKey;
  setIsSaving: (isSaving: boolean) => void;
}

export function ApiKeyApprovalEntity({ approval, apiKey, setIsSaving }: EntitiesRelatedToProps) {
  if (!approval.Entity) {
    return null;
  }
  const entity = approval.Entity;
  return (
    <div
      className="bg-contrast-grey mb-2 flex basis-full flex-row items-center justify-between border-0 border-solid text-left"
      style={{
        boxShadow: 'inset 0 -2px 0 0 var(--border-plain-grey)',
      }}
    >
      <div className="flex flex-1 flex-col border-none p-4 text-left font-bold">
        <Link
          to={`/app/tableau-de-bord/admin/entity/${entity.id}`}
          className="inline-flex! size-full items-center justify-start bg-none! no-underline!"
        >
          {entity.nom_d_usage}
          <br />
          Raison sociale: {entity.raison_sociale}
          <br />
          {entity.siret}
          {entity.numero_ddecpp}
          <br />
          {entity.type}
          <br />
          {entity.address_ligne_1}
          <br />
          {entity.address_ligne_2}
          <br />
          {entity.code_postal} {entity.ville}
        </Link>
      </div>
      <div className="flex flex-row gap-2 pr-4">
        <div className="flex basis-3xs flex-col justify-center gap-2 py-4">
          <ApprovalStatusSelector entity={entity} approval={approval} />
        </div>
        <div className="flex flex-col justify-center gap-2 py-4">
          <Button
            type="button"
            iconId="fr-icon-delete-bin-line"
            onClick={() => {
              if (!window.confirm('Voulez-vous vraiment retirer cette autorisation ?')) return;
              setIsSaving?.(true);
              API.post({
                path: `admin/api-key-approval`,
                body: {
                  api_key_id: apiKey.id,
                  entity_id: entity.id,
                  action: 'delete',
                },
              });
            }}
            title="Retirer"
            priority="tertiary no outline"
          />
        </div>
      </div>
    </div>
  );
}

interface UsersRelatedToProps {
  id: string;
  apiKeyReponseData: State;
  setApiKeyResponseData: (data: State) => void;
  setIsSaving: (isSaving: boolean) => void;
}

function UsersRelatedTo({ apiKeyReponseData, setApiKeyResponseData, setIsSaving }: UsersRelatedToProps) {
  const { apiKey, allUsers } = apiKeyReponseData;

  return (
    <>
      <Highlight
        className="mb-8"
        classes={{
          root: 'fr-highlight--green-emeraude',
        }}
      >
        Cette clé ne pourra accéder qu'aux données des utilisateurs sélectionnés ci-dessous.
      </Highlight>
      {apiKey.approvals.map((approval) => {
        if (!approval.User) {
          return null;
        }
        const user = approval.User;
        return (
          <div
            className={[
              'flex basis-full flex-row items-center justify-between border-solid text-left',
              'bg-contrast-grey mb-2 border-0',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <div className="flex flex-1 flex-col border-none p-4 text-left font-bold">
              <Link
                to={`/app/tableau-de-bord/admin/user/${user.id}`}
                className="inline-flex! size-full items-center justify-start bg-none! no-underline!"
              >
                {user.email}
                <br />
                {user.roles.join(', ')}
                <br />
                {user.numero_cfei}
                <br />
                {user.telephone}
                <br />
                {user.addresse_ligne_1}
                <br />
                {user.addresse_ligne_2}
                <br />
                {user.code_postal} {user.ville}
              </Link>
            </div>
            <div className="flex flex-row gap-2 pr-4">
              <div className="flex basis-3xs flex-col justify-center gap-2 py-4">
                <ApprovalStatusSelector user={user} approval={approval} />
              </div>
              <div className="flex flex-col justify-center gap-2 py-4">
                <Button
                  type="button"
                  iconId="fr-icon-delete-bin-line"
                  onClick={() => {
                    if (!window.confirm('Voulez-vous vraiment retirer cette autorisation ?')) return;
                    setIsSaving(true);
                    API.post({
                      path: `admin/api-key-approval`,
                      body: {
                        api_key_id: apiKey.id,
                        user_id: user.id,
                        action: 'delete',
                      },
                    });
                  }}
                  title="Retirer"
                  priority="tertiary no outline"
                />
              </div>
            </div>
          </div>
        );
      })}
      <div className="p-4 md:p-8 md:pb-0 [&_a]:block [&_a]:p-4 [&_a]:no-underline has-[a]:[&_td]:p-0!">
        <Table
          fixed
          noCaption
          className="[&_td]:h-px"
          data={Object.values(allUsers).map((user) => {
            return [
              <form
                key={user.id}
                id={`api-for-${user.id}`}
                className="flex w-full flex-col items-start gap-4"
                method="POST"
                onSubmit={(event) => {
                  event.preventDefault();
                  setIsSaving(true);
                  API.post({
                    path: `admin/api-key-approval`,
                    body: {
                      action: 'create',
                      api_key_id: apiKey.id,
                      user_id: user.id,
                      status: ApiKeyApprovalStatus.APPROVED,
                    },
                  })
                    .then((res) => res as AdminApiKeyAndApprovalsResponse)
                    .then(() => {
                      loadData(apiKey.id).then((response) => {
                        if (response.data) setApiKeyResponseData(response.data!);
                      });
                    })
                    .finally(() => {
                      setIsSaving(false);
                    });
                }}
              >
                <Link
                  to={`/app/tableau-de-bord/admin/user/${user.id}`}
                  className="inline-flex! size-full items-center justify-start bg-none! no-underline!"
                >
                  {user.prenom} {user.nom_de_famille}
                  <br />＠ {user.email}
                  <br />
                  🏡 {user.code_postal} {user.ville}
                </Link>
                <Button type="submit" className="m-2">
                  Ajouter
                </Button>
              </form>,
              <p
                key={user.id}
                className="inline-flex! size-full items-center justify-start bg-none! no-underline!"
              >
                {user.roles.map((role) => (
                  <Fragment key={role}>
                    {role}
                    <br />
                  </Fragment>
                ))}
              </p>,
            ];
          })}
          headers={['Utilisateur', 'Roles']}
        />
      </div>
    </>
  );
}

const approvalStatusOptions: Array<{
  label: string;
  value: Approval['status'];
}> = [
  {
    label: 'Approuvé',
    value: ApiKeyApprovalStatus.APPROVED,
  },
  {
    label: 'En attente',
    value: ApiKeyApprovalStatus.PENDING,
  },
  {
    label: 'Rejeté',
    value: ApiKeyApprovalStatus.REJECTED,
  },
];

function ApprovalStatusSelector({
  approval,
  entity,
  user,
}: {
  approval: Approval;
  entity?: Entity;
  user?: User;
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
          path: `admin/api-key-approval`,
          body: {
            _action: 'update',
            api_key_id: approval.api_key_id,
            entity_id: entity?.id,
            user_id: user?.id,
            status: newStatus,
          },
        }).then((res) => {
          if (res.ok) {
            setStatus(newStatus!);
          }
        });
      }}
      className="w-full bg-white"
      value={approvalStatusOptions.find((opt) => opt.value === status)}
    />
  );
}
