import { useEffect } from "react";
import { Link, useFetcher, useLoaderData, useNavigate } from "@remix-run/react";
import { clientLoader } from "./route";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { Notice } from "@codegouvfr/react-dsfr/Notice";
import { Prisma } from "@prisma/client";
import { action as nouvelleCarcasseAction } from "~/routes/action.carcasse.nouvelle";

const style = {
  boxShadow: "inset 0 -2px 0 0 var(--border-plain-grey)",
};

export default function CarcassesExaminateur({ canEdit }: { canEdit: boolean }) {
  const { fei } = useLoaderData<typeof clientLoader>();
  const navigate = useNavigate();
  const nouvelleCarcasseFetcher = useFetcher<typeof nouvelleCarcasseAction>({ key: "nouvelle-carcasse" });
  const carcasseFetcher = useFetcher({ key: "carcasse-delete-fetcher" });

  const error = nouvelleCarcasseFetcher.data?.error;

  useEffect(() => {
    if (nouvelleCarcasseFetcher.data?.data?.numero_bracelet) {
      navigate(`/tableau-de-bord/carcasse/${fei.numero}/${nouvelleCarcasseFetcher.data?.data?.numero_bracelet}`);
    }
  }, [nouvelleCarcasseFetcher.data?.data?.numero_bracelet, fei.numero, navigate]);

  return (
    <>
      {fei.Carcasses.map((carcasse) => {
        return (
          // @ts-expect-error we dont type this json
          <Notice
            className="fr-fieldset__element fr-text-default--grey fr-background-contrast--grey [&_p.fr-notice\\_\\_title]:before:hidden"
            key={carcasse.id}
            style={style}
            isClosable={canEdit}
            onClose={() => {
              if (window.confirm("Voulez-vous supprimer cette carcasse ? Cette opération est irréversible")) {
                carcasseFetcher.submit(
                  {
                    numero_bracelet: carcasse.numero_bracelet,
                    _action: "delete",
                    route: `/action/carcasse/${carcasse.numero_bracelet}`,
                  },
                  {
                    method: "POST",
                    preventScrollReset: true,
                  },
                );
              }
            }}
            title={
              <Link
                to={`/tableau-de-bord/carcasse/${fei.numero}/${carcasse.numero_bracelet}`}
                className="w-full !border-none !bg-none text-left !no-underline !shadow-none md:pl-8 [&_*]:no-underline [&_*]:hover:no-underline"
              >
                {carcasse.espece ? (
                  <>
                    <span className="block font-bold md:-mt-4">
                      {carcasse.espece} - {carcasse.categorie}
                    </span>
                    <span className="block font-normal">Numéro de bracelet&nbsp;: {carcasse.numero_bracelet}</span>
                    <span className="block font-normal">
                      Mise à mort&nbsp;: {carcasse.heure_mise_a_mort || "À REMPLIR"}
                    </span>
                    <span className="block font-normal">
                      Éviscération&nbsp;: {carcasse.heure_evisceration || "À REMPLIR"}
                    </span>
                    <br />
                    <span className="m-0 block font-bold">
                      {carcasse.examinateur_anomalies_abats?.length || "Pas d'"} anomalie
                      {carcasse.examinateur_anomalies_abats?.length > 1 ? "s" : ""} abats
                    </span>
                    <span className="m-0 block font-bold md:-mb-4">
                      {carcasse.examinateur_anomalies_carcasse?.length || "Pas d'"} anomalie
                      {carcasse.examinateur_anomalies_carcasse?.length > 1 ? "s" : ""} carcasse
                    </span>
                  </>
                ) : (
                  <>
                    <span className="block font-bold md:-mt-4">Nouvelle carcasse à examiner</span>
                    <span className="block font-normal">Numéro de bracelet&nbsp;: {carcasse.numero_bracelet}</span>
                    <span className="fr-btn mt-2 block md:-mb-4">Examiner</span>
                  </>
                )}
              </Link>
            }
          />
        );
      })}
      {canEdit && (
        <nouvelleCarcasseFetcher.Form
          method="POST"
          className="fr-fieldset__element flex w-full flex-col items-stretch gap-4 md:flex-row md:items-end"
        >
          <input type="hidden" name="route" value="/action/carcasse/nouvelle" />
          <input type="hidden" required name={Prisma.CarcasseScalarFieldEnum.fei_numero} value={fei.numero} />
          <Input
            label="Numéro de bracelet"
            className="!mb-0 grow"
            state={error ? "error" : "default"}
            stateRelatedMessage={error ?? ""}
            nativeInputProps={{
              type: "text",
              required: true,
              name: Prisma.CarcasseScalarFieldEnum.numero_bracelet,
            }}
          />
          <Button type="submit">Ajouter une carcasse</Button>
        </nouvelleCarcasseFetcher.Form>
      )}
    </>
  );
}
