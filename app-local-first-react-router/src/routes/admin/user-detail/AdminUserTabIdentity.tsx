import type { Ref } from 'react';
import { ButtonsGroup } from '@codegouvfr/react-dsfr/ButtonsGroup';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import { Notice } from '@codegouvfr/react-dsfr/Notice';
import { Prisma, UserRoles } from '@prisma/client';
import type { User } from '@prisma/client';
import type { AdminUserDataResponse } from '@api/src/types/responses';
import InputVille from '@app/components/InputVille';

type OfficialCfei = NonNullable<NonNullable<AdminUserDataResponse['data']>['officialCfei']>;

type AdminUserTabIdentityProps = {
  user: User;
  officialCfei: OfficialCfei | null;
  identityDone: boolean;
  examinateurDone: boolean;
  idFormRef: Ref<HTMLFormElement>;
  onIdentityBlur: () => void;
};

export default function AdminUserTabIdentity({
  user,
  officialCfei,
  identityDone,
  examinateurDone,
  idFormRef,
  onIdentityBlur,
}: AdminUserTabIdentityProps) {
  return (
    <form
      id="user_data_form"
      method="POST"
      ref={idFormRef}
      onBlur={onIdentityBlur}
      onSubmit={(event) => event.preventDefault()}
    >
      {!(identityDone && examinateurDone) ? (
        <Notice
          className="fr-mb-2w"
          severity="warning"
          title="Profil incomplet côté utilisateur"
          description="Les indicateurs « identité » et « examinateur » ne sont pas tous validés pour ce compte. Vérifiez les données ci-dessous et le parcours côté app."
        />
      ) : null}

      <input type="hidden" name={Prisma.UserScalarFieldEnum.prefilled} value="true" />
      <Input
        label="Email"
        nativeInputProps={{
          id: Prisma.UserScalarFieldEnum.email,
          name: Prisma.UserScalarFieldEnum.email,
          autoComplete: 'off',
          defaultValue: user.email ?? '',
        }}
      />
      <Input
        label="Nom"
        nativeInputProps={{
          id: Prisma.UserScalarFieldEnum.nom_de_famille,
          name: Prisma.UserScalarFieldEnum.nom_de_famille,
          autoComplete: 'off',
          defaultValue: user.nom_de_famille ?? '',
        }}
      />
      <Input
        label="Prénom"
        nativeInputProps={{
          id: Prisma.UserScalarFieldEnum.prenom,
          name: Prisma.UserScalarFieldEnum.prenom,
          autoComplete: 'off',
          defaultValue: user.prenom ?? '',
        }}
      />
      <Input
        label="Téléphone"
        hintText="Format attendu : 01 22 33 44 55"
        nativeInputProps={{
          id: Prisma.UserScalarFieldEnum.telephone,
          name: Prisma.UserScalarFieldEnum.telephone,
          autoComplete: 'off',
          defaultValue: user.telephone ?? '',
        }}
      />
      <Input
        label="Adresse"
        hintText="Indication : numéro et voie"
        nativeInputProps={{
          id: Prisma.UserScalarFieldEnum.addresse_ligne_1,
          name: Prisma.UserScalarFieldEnum.addresse_ligne_1,
          autoComplete: 'off',
          defaultValue: user.addresse_ligne_1 ?? '',
        }}
      />
      <Input
        label="Complément d'adresse (optionnel)"
        hintText="Indication : bâtiment, immeuble, escalier et numéro d'appartement"
        nativeInputProps={{
          id: Prisma.UserScalarFieldEnum.addresse_ligne_2,
          name: Prisma.UserScalarFieldEnum.addresse_ligne_2,
          autoComplete: 'off',
          defaultValue: user.addresse_ligne_2 ?? '',
        }}
      />

      <div className="flex w-full flex-col gap-x-4 md:flex-row">
        <Input
          label="Code postal"
          hintText="5 chiffres"
          className="shrink-0 md:basis-1/5"
          nativeInputProps={{
            id: Prisma.UserScalarFieldEnum.code_postal,
            name: Prisma.UserScalarFieldEnum.code_postal,
            autoComplete: 'off',
            defaultValue: user.code_postal ?? '',
          }}
        />
        <div className="basis-4/5">
          <InputVille
            key={user.ville}
            postCode={user.code_postal ?? ''}
            trimPostCode
            label="Ville ou commune"
            hintText="Exemple : Montpellier"
            nativeInputProps={{
              id: Prisma.UserScalarFieldEnum.ville,
              name: Prisma.UserScalarFieldEnum.ville,
              autoComplete: 'off',
              defaultValue: user.ville ?? '',
            }}
          />
        </div>
      </div>
      {user.roles.includes(UserRoles.CHASSEUR) && (
        <>
          <Input
            label="Numéro d'attestation de Chasseur Formé à l'Examen Initial"
            hintText="De la forme CFEI-DEP-AA-123 ou DEP-FREI-YY-001"
            nativeInputProps={{
              id: Prisma.UserScalarFieldEnum.numero_cfei,
              name: Prisma.UserScalarFieldEnum.numero_cfei,
              autoComplete: 'off',
              defaultValue: user.numero_cfei ?? '',
            }}
          />
          {user.numero_cfei ? (
            officialCfei ? (
              <Alert
                severity="success"
                small
                className="mb-4"
                description={`CFEI trouvé dans la liste officielle : ${officialCfei.nom ?? ''} ${officialCfei.prenom ?? ''}${officialCfei.departement ? ` — Département ${officialCfei.departement}` : ''}`}
              />
            ) : (
              <Alert
                severity="error"
                small
                className="mb-4"
                description="CFEI non trouvé dans la liste officielle"
              />
            )
          ) : (
            <Alert
              severity="warning"
              small
              className="mb-4"
              description="Numéro CFEI non renseigné"
            />
          )}
        </>
      )}
      <div className="fixed bottom-16 left-0 z-50 flex w-full flex-col border-t border-gray-100 bg-white p-3 pb-2 shadow-2xl md:relative md:bottom-0 md:mt-3 md:w-auto md:items-center md:shadow-none md:[&_ul]:min-w-96">
        <ButtonsGroup
          buttons={[
            {
              children: 'Enregistrer',
              type: 'submit',
              nativeButtonProps: {
                form: 'user_data_form',
              },
            },
          ]}
        />
      </div>
    </form>
  );
}
