import { Link, useFetcher, useLoaderData } from "@remix-run/react";
import { clientLoader } from "./route";
import { Notice } from "@codegouvfr/react-dsfr/Notice";
import NouvelleCarcasse from "./carcasses-nouvelle";
import { CarcasseType } from "@prisma/client";
import { useMemo } from "react";

const style = {
  boxShadow: "inset 0 -2px 0 0 var(--border-plain-grey)",
};

export default function CarcassesExaminateur({ canEdit }: { canEdit: boolean }) {
  const { fei, carcasses, user } = useLoaderData<typeof clientLoader>();
  const carcasseFetcher = useFetcher({ key: "carcasse-delete-fetcher" });

  const countCarcassesByEspece = useMemo(() => {
    return carcasses.reduce(
      (acc, carcasse) => {
        acc[carcasse.espece!] = (acc[carcasse.espece!] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
  }, [carcasses]);

  return (
    <>
      {carcasses.map((carcasse) => {
        const examinationNotFinished =
          !carcasse.examinateur_anomalies_abats?.length &&
          !carcasse.examinateur_anomalies_carcasse?.length &&
          !carcasse.examinateur_carcasse_sans_anomalie;
        // const missingFields =
        //   !carcasse.espece || !carcasse.categorie || !carcasse.heure_mise_a_mort || !carcasse.heure_evisceration;
        // const missingFields = !carcasse.espece || !carcasse.categorie;
        return (
          // @ts-expect-error we dont type this json
          <Notice
            className="fr-fieldset__element fr-text-default--grey fr-background-contrast--grey [&_p.fr-notice\\_\\_title]:before:hidden"
            key={carcasse.numero_bracelet}
            style={style}
            isClosable={user.id === fei.examinateur_initial_user_id || user.id === fei.premier_detenteur_user_id}
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
                      {carcasse.espece}
                      {carcasse.categorie && ` - ${carcasse.categorie}`}
                    </span>
                    <span className="block font-normal">Numéro de bracelet&nbsp;: {carcasse.numero_bracelet}</span>
                    {carcasse.type === CarcasseType.PETIT_GIBIER && (
                      <span className="block font-normal">
                        Nombre de carcasses dans le lot&nbsp;: {carcasse.nombre_d_animaux || "À REMPLIR"}
                      </span>
                    )}
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
                    {/* {(examinationNotFinished || missingFields) && (
                      <>
                        <br />
                        <span className="fr-btn mt-2 block md:-mb-4">Finir l'examination</span>
                      </>
                    )} */}
                    {!examinationNotFinished && (
                      <>
                        {carcasse.type === CarcasseType.GROS_GIBIER && (
                          <>
                            {!carcasse.examinateur_anomalies_abats?.length ? (
                              <>
                                <br />
                                <span className="m-0 block font-bold">Pas d'anomalie abats</span>
                              </>
                            ) : (
                              <>
                                <br />
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
                        )}
                        <>
                          {!carcasse.examinateur_anomalies_carcasse?.length ? (
                            <>
                              <br />
                              <span className="m-0 block font-bold">Pas d'anomalie carcasse</span>
                            </>
                          ) : (
                            <>
                              <br />
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
                    <span className="block font-bold md:-mt-4">Nouveau lot de carcasse(s) à examiner</span>
                    <span className="block font-normal">Numéro de bracelet&nbsp;: {carcasse.numero_bracelet}</span>
                    <span className="fr-btn mt-2 block md:-mb-4">Examiner</span>
                  </>
                )}
              </Link>
            }
          />
        );
      })}
      {carcasses.length > 0 && canEdit && <hr />}
      {carcasses.length > 0 && (
        <p className="-mt-4 mb-4 ml-4 text-sm text-gray-500">
          Déjà rentrés:
          {Object.entries(countCarcassesByEspece).map(([espece, count]) => (
            <span className="ml-4 block" key={espece}>
              {espece}: {count}
            </span>
          ))}
        </p>
      )}
      {canEdit && <NouvelleCarcasse key={fei.commune_mise_a_mort} />}
    </>
  );
}