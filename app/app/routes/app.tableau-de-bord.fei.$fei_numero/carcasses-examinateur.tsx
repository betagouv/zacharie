import { Link, useFetcher, useLoaderData } from "@remix-run/react";
import { clientLoader } from "./route";
import { Notice } from "@codegouvfr/react-dsfr/Notice";
import NouvelleCarcasse from "./carcasses-nouvelle";
import { CarcasseType } from "@prisma/client";
import { useMemo } from "react";
import { CustomNotice } from "@app/components/CustomNotice";

export default function CarcassesExaminateur({ canEdit }: { canEdit: boolean }) {
  const { fei, carcasses, user } = useLoaderData<typeof clientLoader>();
  const carcasseFetcher = useFetcher({ key: "carcasse-delete-fetcher" });

  const countCarcassesByEspece = useMemo(() => {
    return carcasses.reduce(
      (acc, carcasse) => {
        acc[carcasse.espece!] = {
          carcasses: (acc[carcasse.espece!]?.carcasses || 0) + 1,
          nombre_d_animaux: (acc[carcasse.espece!]?.nombre_d_animaux || 0) + (carcasse?.nombre_d_animaux || 0),
        };
        return acc;
      },
      {} as Record<string, { carcasses: number; nombre_d_animaux: number }>,
    );
  }, [carcasses]);

  return (
    <>
      {carcasses.map((carcasse) => {
        // const examinationNotFinished =
        //   !carcasse.examinateur_anomalies_abats?.length &&
        //   !carcasse.examinateur_anomalies_carcasse?.length &&
        // !carcasse.examinateur_carcasse_sans_anomalie;
        // const missingFields =
        //   !carcasse.espece || !carcasse.categorie || !carcasse.heure_mise_a_mort || !carcasse.heure_evisceration;
        // const missingFields = !carcasse.espece || !carcasse.categorie;
        return (
          <CustomNotice
            key={carcasse.numero_bracelet}
            className={`mb-2 ${carcasse.type === CarcasseType.PETIT_GIBIER ? "!bg-gray-300" : ""}`}
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
          >
            <Link
              to={`/app/tableau-de-bord/carcasse/${fei.numero}/${carcasse.numero_bracelet}`}
              className="block w-full bg-none p-4 text-left [&_*]:no-underline [&_*]:hover:no-underline"
            >
              {carcasse.espece ? (
                <>
                  <span className="block font-bold">
                    {carcasse.espece}
                    {carcasse.categorie && ` - ${carcasse.categorie}`}
                  </span>
                  <span className="absolute right-8 top-2.5 block text-sm font-normal italic opacity-50">
                    {carcasse.type === CarcasseType.PETIT_GIBIER ? "Petit gibier" : "Grand gibier"}
                  </span>
                  <span className="block font-normal">
                    Numéro de bracelet&nbsp;: <span className="whitespace-nowrap">{carcasse.numero_bracelet}</span>
                  </span>
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
                  {!!carcasse.examinateur_anomalies_abats?.length && (
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
                  {!!carcasse.examinateur_anomalies_carcasse?.length && (
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
              ) : (
                <>
                  <span className="block font-bold md:-mt-4">Nouveau lot de carcasse(s) à examiner</span>
                  <span className="block font-normal">Numéro de bracelet&nbsp;: {carcasse.numero_bracelet}</span>
                  <span className="fr-btn mt-2 block md:-mb-4">Examiner</span>
                </>
              )}
            </Link>
          </CustomNotice>
        );
      })}
      {carcasses.length > 0 && canEdit && <hr />}
      {carcasses.length > 0 && canEdit && (
        <p className="-mt-4 mb-4 ml-4 text-sm text-gray-500">
          Déjà rentrés&nbsp;:
          {Object.entries(countCarcassesByEspece).map(([espece, { carcasses, nombre_d_animaux }]) => (
            <span className="ml-4 block" key={espece}>
              {espece}&nbsp;: {carcasses}{" "}
              {nombre_d_animaux > carcasses ? `lots (${nombre_d_animaux} carcasses)` : "carcasses"}
            </span>
          ))}
        </p>
      )}
      {canEdit && <NouvelleCarcasse key={fei.commune_mise_a_mort} />}
    </>
  );
}
