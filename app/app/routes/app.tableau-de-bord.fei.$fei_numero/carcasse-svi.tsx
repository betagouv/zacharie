import { Link, useFetcher, useLoaderData } from "@remix-run/react";
import { useMemo, useState } from "react";
import { clientLoader } from "./route";
import { Prisma, Carcasse, CarcasseType } from "@prisma/client";
import dayjs from "dayjs";
import type { SerializeFrom } from "@remix-run/node";
import { CustomNotice } from "@app/components/CustomNotice";

interface CarcasseAVerifierProps {
  carcasse: SerializeFrom<Carcasse>;
  canEdit: boolean;
}

export default function CarcasseSVI({ carcasse, canEdit }: CarcasseAVerifierProps) {
  const { fei, inetermediairesPopulated } = useLoaderData<typeof clientLoader>();
  const sviCarcasseFetcher = useFetcher({ key: `svi-carcasse-resume-${carcasse.numero_bracelet}` });

  const [motifsSaisie, setMotifsSaisie] = useState(carcasse?.svi_carcasse_saisie_motif?.filter(Boolean) ?? []);
  const priseEnCharge = !carcasse.svi_carcasse_saisie;
  const commentairesIntermediaires = useMemo(() => {
    const commentaires = [];
    for (const intermediaire of inetermediairesPopulated) {
      const intermediaireCarcasse = intermediaire.carcasses[carcasse.numero_bracelet];
      if (intermediaireCarcasse?.commentaire) {
        commentaires.push(`${intermediaire.entity?.raison_sociale} : ${intermediaireCarcasse?.commentaire}`);
      }
    }
    return commentaires;
  }, [inetermediairesPopulated, carcasse]);

  const Component = canEdit ? Link : "div";

  return (
    <div
      key={carcasse.updated_at}
      className={[
        "border-4 border-transparent",
        !!carcasse.svi_carcasse_saisie?.length && "!border-red-500",
        !!canEdit && priseEnCharge && "!border-action-high-blue-france",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <CustomNotice
        key={carcasse.numero_bracelet}
        className={`${carcasse.type === CarcasseType.PETIT_GIBIER ? "!bg-gray-300" : ""}`}
      >
        <Component
          className="block w-full p-4 text-left [&_*]:no-underline [&_*]:hover:no-underline"
          to={canEdit ? `/app/tableau-de-bord/carcasse-svi/${fei.numero}/${carcasse.numero_bracelet}` : ""}
        >
          <span className="block font-bold">
            {carcasse.espece}
            {carcasse.categorie && ` - ${carcasse.categorie}`}
          </span>
          <span className="absolute right-8 top-2.5 block text-sm font-normal italic opacity-50">
            {carcasse.type === CarcasseType.PETIT_GIBIER ? "Petit gibier" : "Grand gibier"}
          </span>
          <span className="block font-normal">
            {carcasse.type === CarcasseType.PETIT_GIBIER ? "Numéro d'identification" : "Numéro de bracelet"}&nbsp;:{" "}
            <span className="whitespace-nowrap">{carcasse.numero_bracelet}</span>
          </span>
          {carcasse.type === CarcasseType.PETIT_GIBIER && (
            <span className="block font-normal">
              Nombre de carcasses dans le lot&nbsp;: {carcasse.nombre_d_animaux || "À REMPLIR"}
            </span>
          )}
          {carcasse.heure_mise_a_mort && (
            <span className="block font-normal">Mise à mort&nbsp;: {carcasse.heure_mise_a_mort || "À REMPLIR"}</span>
          )}
          {carcasse.heure_evisceration && (
            <span className="block font-normal">Éviscération&nbsp;: {carcasse.heure_evisceration || "À REMPLIR"}</span>
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
          {commentairesIntermediaires.map((commentaire, index) => {
            return (
              <span key={commentaire + index} className="mt-2 block font-normal">
                {commentaire}
              </span>
            );
          })}
          <br />
          <span className="m-0 block font-bold" key={JSON.stringify(carcasse.svi_carcasse_saisie_motif)}>
            Inspection SVI&nbsp;:
            {carcasse.svi_carcasse_saisie.length > 0 ? (
              <>
                {carcasse.svi_carcasse_saisie.map((type, index) => {
                  if (index === 0) {
                    // Saisie totale ou saisie partielle
                    return (
                      <span className="m-0 ml-2 block font-medium" key={type + index}>
                        {type}
                      </span>
                    );
                  }
                  return (
                    <span className="m-0 ml-2 block font-medium" key={type + index}>
                      - {type}
                    </span>
                  );
                })}
                <>
                  {motifsSaisie.map((motif, index) => {
                    if (canEdit) {
                      return (
                        <span
                          className="m-0 ml-2 flex items-center justify-between border-b border-b-gray-300 font-medium"
                          key={motif + index}
                        >
                          - {motif}
                          <button
                            className="block px-4 py-1 font-medium"
                            title="Supprimer"
                            key={motif + index}
                            onClick={() => {
                              const nextMotifsSaisie = motifsSaisie.filter((motifSaisie) => motifSaisie !== motif);
                              setMotifsSaisie((motifsSaisie) => {
                                return motifsSaisie.filter((motifSaisie) => motifSaisie !== motif);
                              });
                              const form = new FormData();
                              if (nextMotifsSaisie.length) {
                                for (const motifSaisie of nextMotifsSaisie) {
                                  form.append(Prisma.CarcasseScalarFieldEnum.svi_carcasse_saisie_motif, motifSaisie);
                                }
                                form.append(
                                  Prisma.CarcasseScalarFieldEnum.svi_carcasse_saisie_at,
                                  dayjs().toISOString(),
                                );
                              } else {
                                form.append(Prisma.CarcasseScalarFieldEnum.svi_carcasse_saisie_motif, "");
                                form.append(Prisma.CarcasseScalarFieldEnum.svi_carcasse_saisie, "");
                                form.append(Prisma.CarcasseScalarFieldEnum.svi_carcasse_saisie_at, "");
                              }
                              form.append(Prisma.CarcasseScalarFieldEnum.svi_carcasse_signed_at, dayjs().toISOString());
                              form.append(Prisma.CarcasseScalarFieldEnum.fei_numero, fei.numero);
                              form.append("route", `/api/fei-carcasse/${fei.numero}/${carcasse.numero_bracelet}`);
                              sviCarcasseFetcher.submit(form, {
                                method: "POST",
                                preventScrollReset: true,
                              });
                            }}
                          >
                            {`\u0078`}
                          </button>
                        </span>
                      );
                    }
                    return (
                      <span className="m-0 ml-2 block font-medium" key={motif + index}>
                        - {motif}
                      </span>
                    );
                  })}
                </>
              </>
            ) : (
              <span className="m-0 ml-2 block font-medium">- Pas de saisie</span>
            )}
          </span>
          {!canEdit && carcasse.svi_carcasse_commentaire && (
            <>
              <br />
              <span className="m-0 block font-bold">Commentaire du SVI&nbsp;:</span>
              <span className="m-0 ml-2 block border-l-2 border-l-gray-400 pl-4 font-medium">
                {carcasse.svi_carcasse_commentaire}
              </span>
            </>
          )}
        </Component>
      </CustomNotice>
    </div>
  );
}
