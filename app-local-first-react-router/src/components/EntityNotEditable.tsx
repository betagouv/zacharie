import { Prisma, User, Entity } from '@prisma/client';
import InputNotEditable from './InputNotEditable';
import { getUserRoleLabel } from '@app/utils/get-user-roles-label';

export default function EntityNotEditable({
  hideType = false,
  user = null,
  entity = null,
}: {
  hideType?: boolean;
  user: null | {
    nom_de_famille: User['nom_de_famille'];
    prenom: User['prenom'];
    telephone: User['telephone'];
    email: User['email'];
  };
  entity: null | {
    type: Entity['type'];
    raison_sociale: Entity['raison_sociale'];
    nom_d_usage: Entity['nom_d_usage'];
    siret: Entity['siret'];
    numero_ddecpp: Entity['numero_ddecpp'];
    address_ligne_1: Entity['address_ligne_1'];
    address_ligne_2: Entity['address_ligne_2'];
    code_postal: Entity['code_postal'];
    ville: Entity['ville'];
  };
}) {
  return (
    <>
      {!hideType && (
        <div className="fr-fieldset__element">
          <InputNotEditable
            label="Type"
            nativeInputProps={{
              id: Prisma.EntityScalarFieldEnum.type,
              name: Prisma.EntityScalarFieldEnum.type,
              autoComplete: 'off',
              defaultValue: getUserRoleLabel(entity?.type ?? ''),
            }}
          />
        </div>
      )}
      {entity?.nom_d_usage && (
        <div className="fr-fieldset__element">
          <InputNotEditable
            label="Nom d'usage"
            nativeInputProps={{
              id: Prisma.EntityScalarFieldEnum.nom_d_usage,
              name: Prisma.EntityScalarFieldEnum.nom_d_usage,
              autoComplete: 'off',
              defaultValue: entity?.nom_d_usage ?? '',
            }}
          />
        </div>
      )}
      <div className="fr-fieldset__element">
        <InputNotEditable
          label="Raison Sociale"
          nativeInputProps={{
            id: Prisma.EntityScalarFieldEnum.raison_sociale,
            name: Prisma.EntityScalarFieldEnum.raison_sociale,
            autoComplete: 'off',
            defaultValue: entity?.raison_sociale ?? '',
          }}
        />
      </div>
      {entity?.siret && (
        <div className="fr-fieldset__element">
          <InputNotEditable
            label="SIRET"
            nativeInputProps={{
              id: Prisma.EntityScalarFieldEnum.siret,
              name: Prisma.EntityScalarFieldEnum.siret,
              autoComplete: 'off',
              defaultValue: entity?.siret ?? '',
            }}
          />
        </div>
      )}
      {entity?.numero_ddecpp && (
        <div className="fr-fieldset__element">
          <InputNotEditable
            label="Numéro DD(ec)PP"
            nativeInputProps={{
              id: Prisma.EntityScalarFieldEnum.numero_ddecpp,
              name: Prisma.EntityScalarFieldEnum.numero_ddecpp,
              autoComplete: 'off',
              defaultValue: entity?.numero_ddecpp ?? '',
            }}
          />
        </div>
      )}
      <div className="fr-fieldset__element">
        <InputNotEditable
          label="Adresse"
          nativeInputProps={{
            autoComplete: 'off',
            defaultValue: `${entity?.address_ligne_1 ?? ''} ${entity?.address_ligne_2 ?? ''} - ${
              entity?.code_postal ?? ''
            } ${entity?.ville ?? ''}`,
          }}
        />
      </div>
      <hr />
      <div className="fr-fieldset__element">
        <InputNotEditable
          label={
            <>
              <span className="ml-2 block font-medium">Représenté ici par</span>
              <br />
              <br />
              Nom de famille
            </>
          }
          nativeInputProps={{
            id: Prisma.UserScalarFieldEnum.nom_de_famille,
            name: Prisma.UserScalarFieldEnum.nom_de_famille,
            autoComplete: 'off',
            defaultValue: user?.nom_de_famille ?? '',
          }}
        />
      </div>
      <div className="fr-fieldset__element">
        <InputNotEditable
          label="Prénom"
          className="[&_input]:bg-transparent"
          nativeInputProps={{
            id: Prisma.UserScalarFieldEnum.prenom,
            name: Prisma.UserScalarFieldEnum.prenom,
            autoComplete: 'off',
            defaultValue: user?.prenom ?? '',
          }}
        />
      </div>
      <div className="fr-fieldset__element">
        <InputNotEditable
          label="Téléphone"
          className="[&_input]:bg-transparent"
          nativeInputProps={{
            id: Prisma.UserScalarFieldEnum.telephone,
            name: Prisma.UserScalarFieldEnum.telephone,
            autoComplete: 'off',
            defaultValue: user?.telephone ?? '',
          }}
        />
      </div>
      <div className="fr-fieldset__element">
        <InputNotEditable
          label="Email"
          className="[&_input]:bg-transparent"
          nativeInputProps={{
            id: Prisma.UserScalarFieldEnum.email,
            name: Prisma.UserScalarFieldEnum.email,
            autoComplete: 'off',
            defaultValue: user?.email ?? '',
          }}
        />
      </div>
    </>
  );
}
