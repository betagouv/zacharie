import { useLoaderData } from "@remix-run/react";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { Select } from "@codegouvfr/react-dsfr/Select";
import { UserRoles } from "@prisma/client";
import { loader } from "./route";

export default function FEIExaminateurInitial({ feiInitRoles }: { feiInitRoles: UserRoles[] }) {
  const { user, fei, fei_owners, examinateursInitiaux } = useLoaderData<typeof loader>();

  return (
    <>
      <div className="fr-fieldset__element">
        <Select
          label="Éxaminateur Initial"
          hint="Sélectionnez l'Examinateur Initial de pour cette FEI"
          key={`${feiInitRoles.includes(UserRoles.DETENTEUR_INITIAL)}`}
          className="!mb-0 grow"
          nativeSelectProps={{
            name: "entity_id",
            defaultValue:
              fei_owners?.detenteur_initial_id ?? feiInitRoles.includes(UserRoles.DETENTEUR_INITIAL) ? user.id : "",
          }}
        >
          <option value="">Sélectionnez l'Examinateur Initial de pour cette FEI</option>
          {examinateursInitiaux.map((examinateur) => {
            let label = `${examinateur.prenom} ${examinateur.nom_de_famille} - ${examinateur.code_postal} ${examinateur.ville}`;
            if (examinateur.id === user.id) {
              label = `Vous (${label})`;
            }
            return (
              <option key={examinateur.id} value={examinateur.id}>
                {label}
              </option>
            );
          })}
        </Select>
      </div>
      <div className="fr-fieldset__element">
        <Input
          label="Date de mise à mort et d'éviscération"
          nativeInputProps={{
            id: "date_mise_a_mort",
            name: "date_mise_a_mort",
            type: "date",
            autoComplete: "off",
            defaultValue: fei?.date_mise_a_mort ?? new Date().toISOString().split("T")[0],
          }}
        />
      </div>
      <div className="fr-fieldset__element">
        <Input
          label="Commune de mise à mort"
          nativeInputProps={{
            id: "commune_mise_a_mort",
            name: "commune_mise_a_mort",
            type: "text",
            autoComplete: "off",
            defaultValue: fei?.commune_mise_a_mort ?? "",
          }}
        />
      </div>
    </>
  );
}
