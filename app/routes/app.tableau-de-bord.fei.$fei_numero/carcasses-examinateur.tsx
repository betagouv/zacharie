import { Link, useFetcher, useLoaderData } from "@remix-run/react";
import { clientLoader } from "./route";
import { Notice } from "@codegouvfr/react-dsfr/Notice";
import NouvelleCarcasse from "./carcasses-nouvelle";

const style = {
  boxShadow: "inset 0 -2px 0 0 var(--border-plain-grey)",
};

export default function CarcassesExaminateur({ canEdit }: { canEdit: boolean }) {
  const { fei, carcasses } = useLoaderData<typeof clientLoader>();
  const carcasseFetcher = useFetcher({ key: "carcasse-delete-fetcher" });

  return (
    <>
      {carcasses.map((carcasse) => {
        const examinationNotFinished =
          !carcasse.examinateur_anomalies_abats?.length &&
          !carcasse.examinateur_anomalies_carcasse?.length &&
          !carcasse.examinateur_carcasse_sans_anomalie;
        // const missingFields =
        //   !carcasse.espece || !carcasse.categorie || !carcasse.heure_mise_a_mort || !carcasse.heure_evisceration;
        const missingFields = !carcasse.espece || !carcasse.categorie;
        return (
          // @ts-expect-error we dont type this json
          <Notice
            className="fr-fieldset__element fr-text-default--grey fr-background-contrast--grey [&_p.fr-notice\\_\\_title]:before:hidden"
            key={carcasse.numero_bracelet}
            style={style}
            isClosable={canEdit}
            onClose={() => {
              if (window.confirm("Voulez-vous supprimer cette carcasse ? Cette opération est irréversible")) {
                carcasseFetcher.submit(
                  {
                    numero_bracelet: carcasse.numero_bracelet,
                    fei_numero: fei.numero,
                    _action: "delete",
                    route: `/api/fei-carcasse/${fei.numero}/${carcasse.numero_bracelet}`,
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
                to={`/app/tableau-de-bord/carcasse/${fei.numero}/${carcasse.numero_bracelet}`}
                className="w-full !border-none !bg-none text-left !no-underline !shadow-none md:pl-8 [&_*]:no-underline [&_*]:hover:no-underline"
              >
                {carcasse.espece ? (
                  <>
                    <span className="block font-bold md:-mt-4">
                      {carcasse.espece} - {carcasse.categorie}
                    </span>
                    <span className="block font-normal">Numéro de bracelet&nbsp;: {carcasse.numero_bracelet}</span>
                    {carcasse.heure_mise_a_mort && (
                      <span className="block font-normal">
                        Mise à mort&nbsp;: {carcasse.heure_mise_a_mort || "À REMPLIR"}
                      </span>
                    )}
                    {carcasse.heure_evisceration && (
                      <span className="block font-normal">
                        Éviscération&nbsp;: {carcasse.heure_evisceration || "À REMPLIR"}
                      </span>
                    )}
                    {(examinationNotFinished || missingFields) && (
                      <>
                        <br />
                        <span className="fr-btn mt-2 block md:-mb-4">Finir l'examination</span>
                      </>
                    )}
                    <br />
                    {!examinationNotFinished && (
                      <>
                        <>
                          {!carcasse.examinateur_anomalies_abats?.length ? (
                            <span className="m-0 block font-bold">Pas d'anomalie abats</span>
                          ) : (
                            <>
                              <span className="m-0 block font-bold">Anomalies abats:</span>
                              {carcasse.examinateur_anomalies_abats.map((anomalie) => {
                                return (
                                  <>
                                    <span className="m-0 ml-2 block font-bold">{anomalie}</span>
                                  </>
                                );
                              })}
                            </>
                          )}
                        </>
                        <>
                          {!carcasse.examinateur_anomalies_carcasse?.length ? (
                            <span className="m-0 block font-bold">Pas d'anomalie carcasse</span>
                          ) : (
                            <>
                              <span className="m-0 block font-bold">Anomalies carcasse:</span>
                              {carcasse.examinateur_anomalies_carcasse.map((anomalie) => {
                                return (
                                  <>
                                    <span className="m-0 ml-2 block font-bold">{anomalie}</span>
                                  </>
                                );
                              })}
                            </>
                          )}
                        </>
                      </>
                    )}
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
      {canEdit && <NouvelleCarcasse />}
    </>
  );
}
