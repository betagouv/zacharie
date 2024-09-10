import { User } from "@prisma/client";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { SerializeFrom } from "@remix-run/node";

export default function UserNtEditable({
  user = null,
  withCfei = false,
}: {
  user: null | SerializeFrom<User>;
  withCfei?: boolean;
}) {
  return (
    <>
      <div className="fr-fieldset__element">
        <Input
          label="Nom de famille"
          className="[&_input]:bg-transparent"
          nativeInputProps={{
            id: "nom_de_famille",
            name: "nom_de_famille",
            autoComplete: "off",
            readOnly: true,
            defaultValue: user?.nom_de_famille ?? "",
          }}
        />
      </div>
      <div className="fr-fieldset__element">
        <Input
          label="Prénom"
          className="[&_input]:bg-transparent"
          nativeInputProps={{
            id: "prenom",
            name: "prenom",
            autoComplete: "off",
            readOnly: true,
            defaultValue: user?.prenom ?? "",
          }}
        />
      </div>
      <div className="fr-fieldset__element">
        <Input
          label="Téléphone"
          className="[&_input]:bg-transparent"
          nativeInputProps={{
            id: "telephone",
            name: "telephone",
            autoComplete: "off",
            readOnly: true,
            defaultValue: user?.telephone ?? "",
          }}
        />
      </div>
      <div className="fr-fieldset__element">
        <Input
          label="Email"
          className="[&_input]:bg-transparent"
          nativeInputProps={{
            id: "email",
            name: "email",
            autoComplete: "off",
            readOnly: true,
            defaultValue: user?.email ?? "",
          }}
        />
      </div>
      <div className="fr-fieldset__element">
        <Input
          label="Adresse"
          className="[&_input]:bg-transparent"
          nativeInputProps={{
            id: "addresse_ligne_1",
            name: "addresse_ligne_1",
            autoComplete: "off",
            readOnly: true,
            defaultValue: user?.addresse_ligne_1 ?? "",
          }}
        />
      </div>
      {user?.addresse_ligne_2 && (
        <div className="fr-fieldset__element">
          <Input
            label="Complément d'adresse (optionnel)"
            className="[&_input]:bg-transparent"
            nativeInputProps={{
              id: "addresse_ligne_2",
              name: "addresse_ligne_2",
              autoComplete: "off",
              readOnly: true,
              defaultValue: user?.addresse_ligne_2 ?? "",
            }}
          />
        </div>
      )}
      <div className="fr-fieldset__element fr-fieldset__element--inline fr-fieldset__element--postal flex">
        <Input
          label="Code postal"
          className="[&_input]:bg-transparent"
          nativeInputProps={{
            id: "code_postal",
            name: "code_postal",
            autoComplete: "off",
            readOnly: true,
            defaultValue: user?.code_postal ?? "",
          }}
        />
      </div>
      <div className="fr-fieldset__element fr-fieldset__element--inline@md fr-fieldset__element--inline-grow">
        <Input
          label="Ville ou commune"
          className="[&_input]:bg-transparent"
          nativeInputProps={{
            id: "ville",
            name: "ville",
            autoComplete: "off",
            readOnly: true,
            defaultValue: user?.ville ?? "",
          }}
        />
      </div>
      {withCfei && (
        <div className="fr-fieldset__element">
          {user?.numero_frei ? (
            <Input
              label="Numéro FREI"
              hintText="Formateur Référent Examen Initial"
              className="[&_input]:bg-transparent"
              nativeInputProps={{
                id: "cfei",
                name: "cfei",
                autoComplete: "off",
                readOnly: true,
                defaultValue: user?.numero_cfei ?? "",
              }}
            />
          ) : (
            <Input
              label="Numéro CFEI"
              hintText="Chasseur Formé à l'Examen Initial"
              className="[&_input]:bg-transparent"
              nativeInputProps={{
                id: "cfei",
                name: "cfei",
                autoComplete: "off",
                placeholder: "Non renseigné",
                readOnly: true,
                defaultValue: user?.numero_cfei ?? "",
              }}
            />
          )}
        </div>
      )}
    </>
  );
}
