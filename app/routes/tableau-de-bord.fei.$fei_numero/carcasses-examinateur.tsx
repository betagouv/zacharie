import { useFetcher, useLoaderData } from "@remix-run/react";
import { loader } from "./route";
import { Notice } from "@codegouvfr/react-dsfr/Notice";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { Prisma } from "@prisma/client";

const style = {
  boxShadow: "inset 0 -2px 0 0 var(--border-plain-grey)",
};

export default function CarcassesExaminateur() {
  const { fei } = useLoaderData<typeof loader>();
  const carcasseFetcher = useFetcher();
  return (
    <>
      {fei.Carcasses.map((carcasse) => {
        return (
          <Notice
            className="fr-fieldset__element [&_p.fr-notice__title]:before:hidden fr-text-default--grey fr-background-contrast--grey"
            key={carcasse.id}
            style={style}
            isClosable
            onClose={() => {
              carcasseFetcher.submit(
                {
                  numero_bracelet: carcasse.numero_bracelet,
                  _action: "delete",
                },
                {
                  method: "POST",
                  action: `/action/carcasse/${carcasse.numero_bracelet}`,
                  preventScrollReset: true,
                }
              );
            }}
            title={
              <>
                {carcasse.espece} - {carcasse.categorie}
                <br />
                {carcasse.numero_bracelet}
              </>
            }
          />
        );
      })}
      <Button type="button">Ajouter une carcasse</Button>
    </>
  );
}
