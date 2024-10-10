import { Prisma, User } from "@prisma/client";
import type { SerializeFrom } from "@remix-run/node";
import InputNotEditable from "./InputNotEditable";

export default function UserNtEditable({
  user = null,
  withCfei = false,
}: {
  user:
    | null
    | SerializeFrom<User>
    | Pick<
        User,
        | "nom_de_famille"
        | "prenom"
        | "telephone"
        | "email"
        | "addresse_ligne_1"
        | "addresse_ligne_2"
        | "code_postal"
        | "ville"
        | "numero_cfei"
      >;
  withCfei?: boolean;
}) {
  return (
    <>
      <div className="fr-fieldset__element">
        <InputNotEditable
          label="Nom de famille"
          nativeInputProps={{
            id: Prisma.UserScalarFieldEnum.nom_de_famille,
            name: Prisma.UserScalarFieldEnum.nom_de_famille,
            autoComplete: "off",
            defaultValue: user?.nom_de_famille ?? "",
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
            autoComplete: "off",
            defaultValue: user?.prenom ?? "",
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
            autoComplete: "off",
            defaultValue: user?.telephone ?? "",
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
            autoComplete: "off",
            defaultValue: user?.email ?? "",
          }}
        />
      </div>
      <div className="fr-fieldset__element">
        <InputNotEditable
          label="Adresse"
          className="[&_input]:bg-transparent"
          nativeInputProps={{
            id: Prisma.UserScalarFieldEnum.addresse_ligne_1,
            name: Prisma.UserScalarFieldEnum.addresse_ligne_1,
            autoComplete: "off",
            defaultValue: user?.addresse_ligne_1 ?? "",
          }}
        />
      </div>
      {user?.addresse_ligne_2 && (
        <div className="fr-fieldset__element">
          <InputNotEditable
            label="Complément d'adresse (optionnel)"
            className="[&_input]:bg-transparent"
            nativeInputProps={{
              id: Prisma.UserScalarFieldEnum.addresse_ligne_2,
              name: Prisma.UserScalarFieldEnum.addresse_ligne_2,
              autoComplete: "off",
              defaultValue: user?.addresse_ligne_2 ?? "",
            }}
          />
        </div>
      )}
      <div className="fr-fieldset__element fr-fieldset__element--inline fr-fieldset__element--postal flex">
        <InputNotEditable
          label="Code postal"
          className="[&_input]:bg-transparent"
          nativeInputProps={{
            id: Prisma.UserScalarFieldEnum.code_postal,
            name: Prisma.UserScalarFieldEnum.code_postal,
            autoComplete: "off",
            defaultValue: user?.code_postal ?? "",
          }}
        />
      </div>
      <div className="fr-fieldset__element fr-fieldset__element--inline@md fr-fieldset__element--inline-grow">
        <InputNotEditable
          label="Ville ou commune"
          className="[&_input]:bg-transparent"
          nativeInputProps={{
            id: Prisma.UserScalarFieldEnum.ville,
            name: Prisma.UserScalarFieldEnum.ville,
            autoComplete: "off",
            defaultValue: user?.ville ?? "",
          }}
        />
      </div>
      {withCfei && (
        <div className="fr-fieldset__element">
          <InputNotEditable
            label="Numéro CFEI"
            hintText="Chasseur Formé à l'Examen Initial"
            className="[&_input]:bg-transparent"
            nativeInputProps={{
              id: Prisma.UserScalarFieldEnum.numero_cfei,
              name: Prisma.UserScalarFieldEnum.numero_cfei,
              autoComplete: "off",
              placeholder: "Non renseigné",
              defaultValue: user?.numero_cfei ?? "",
            }}
          />
        </div>
      )}
    </>
  );
}
