import { useLoaderData } from "@remix-run/react";
import { loader } from "./route";
import UserNotEditable from "~/components/UserNotEditable";

export default function FEIDetenteurInitial() {
  const { fei } = useLoaderData<typeof loader>();

  return (
    <>
      <div className="fr-fieldset__element">
        {/* <Select
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
        </Select> */}
      </div>
      <UserNotEditable user={fei.FeiDetenteurInitialUser} withCfei />
    </>
  );
}
