import { useFetcher, useLoaderData } from "@remix-run/react";
import { useMemo, useState } from "react";
import { clientLoader } from "./route";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { Prisma, Carcasse, CarcasseType } from "@prisma/client";
import saisieSvi from "@app/data/saisie-svi.json";
import dayjs from "dayjs";
import { ButtonsGroup } from "@codegouvfr/react-dsfr/ButtonsGroup";
import type { SerializeFrom } from "@remix-run/node";
import InputForSearchPrefilledData from "@app/components/InputForSearchPrefilledData";
import { CustomNotice } from "@app/components/CustomNotice";

export default function CarcassesSvi({
  canEdit,
  carcasses,
}: {
  canEdit: boolean;
  carcasses: SerializeFrom<Carcasse>[];
}) {
  return (
    <>
      {carcasses.map((carcasse) => {
        return <CarcasseAVerifier canEdit={canEdit} key={carcasse.numero_bracelet} carcasse={carcasse} />;
      })}
    </>
  );
}

interface CarcasseAVerifierProps {
  carcasse: SerializeFrom<Carcasse>;
  canEdit: boolean;
}

function CarcasseAVerifier({ carcasse, canEdit }: CarcasseAVerifierProps) {
  const { fei, inetermediairesPopulated } = useLoaderData<typeof clientLoader>();
  const sviCarcasseFetcher = useFetcher({ key: `svi-carcasse-${carcasse.numero_bracelet}` });

  const [showSaisir, setShowSaisir] = useState(!!carcasse?.svi_carcasse_saisie);
  console.log("carcasse?.svi_carcasse_saisie", carcasse?.svi_carcasse_saisie);
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

  const Component = canEdit ? "button" : "div";

  return (
    <div
      key={carcasse.updated_at}
      className={[
        "border-4 border-transparent",
        !!carcasse.svi_carcasse_saisie && "!border-red-500",
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
          type={canEdit ? "button" : undefined}
          onClick={canEdit ? () => setShowSaisir(true) : undefined}
        >
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
          {(!canEdit || motifsSaisie.length > 0) && (
            <span className="m-0 block font-bold" key={JSON.stringify(carcasse.svi_carcasse_saisie_motif)}>
              Inspection SVI&nbsp;:
              {motifsSaisie.length > 0 ? (
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
                                form.append(Prisma.CarcasseScalarFieldEnum.svi_carcasse_saisie, "true");
                                form.append(
                                  Prisma.CarcasseScalarFieldEnum.svi_carcasse_saisie_at,
                                  dayjs().toISOString(),
                                );
                              } else {
                                form.append(Prisma.CarcasseScalarFieldEnum.svi_carcasse_saisie_motif, "");
                                form.append(Prisma.CarcasseScalarFieldEnum.svi_carcasse_saisie, "false");
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
              ) : (
                <span className="m-0 ml-2 block font-medium">- Pas de saisie</span>
              )}
            </span>
          )}
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
      {canEdit && showSaisir && (
        <sviCarcasseFetcher.Form method="POST" id={`svi-carcasse-${carcasse.numero_bracelet}`}>
          <input type="hidden" name="route" value={`/api/fei-carcasse/${fei.numero}/${carcasse.numero_bracelet}`} />
          <input
            form={`svi-carcasse-${carcasse.numero_bracelet}`}
            type="hidden"
            name={Prisma.CarcasseScalarFieldEnum.fei_numero}
            value={fei.numero}
          />
          <input
            type="hidden"
            form={`svi-carcasse-${carcasse.numero_bracelet}`}
            name={Prisma.CarcasseScalarFieldEnum.numero_bracelet}
            value={carcasse.numero_bracelet}
          />
          <input
            form={`svi-carcasse-${carcasse.numero_bracelet}`}
            type="hidden"
            name={Prisma.CarcasseScalarFieldEnum.svi_carcasse_saisie}
            value="true"
          />
          {motifsSaisie.map((motifSaisie, index) => {
            return (
              <input
                key={motifSaisie + index}
                form={`svi-carcasse-${carcasse.numero_bracelet}`}
                type="hidden"
                required
                name={Prisma.CarcasseScalarFieldEnum.svi_carcasse_saisie_motif}
                value={motifSaisie}
              />
            );
          })}
          <div className="fr-fieldset__element mt-4">
            <InputForSearchPrefilledData
              canEdit
              data={saisieSvi[carcasse.type ?? CarcasseType.GROS_GIBIER]}
              label="Motif de la saisie"
              hideDataWhenNoSearch
              clearInputOnClick
              placeholder={
                motifsSaisie.length
                  ? "Commencez à taper un autre de saisie supplémentaire"
                  : "Commencez à taper un motif de saisie"
              }
              onSelect={(newMotifSaisie) => {
                setMotifsSaisie([...motifsSaisie, newMotifSaisie]);
              }}
            />
          </div>
          <div className="fr-fieldset__element">
            <Input
              label="Commentaire"
              hintText="Un commentaire à ajouter ?"
              textArea
              nativeTextAreaProps={{
                name: Prisma.CarcasseScalarFieldEnum.svi_carcasse_commentaire,
                form: `svi-carcasse-${carcasse.numero_bracelet}`,
                defaultValue: carcasse?.svi_carcasse_commentaire || "",
                onBlur: (e) => {
                  console.log("submit comment");
                  const form = new FormData();
                  form.append(Prisma.CarcasseScalarFieldEnum.svi_carcasse_commentaire, e.target.value);
                  form.append(Prisma.CarcasseScalarFieldEnum.fei_numero, fei.numero);
                  form.append("route", `/api/fei-carcasse/${fei.numero}/${carcasse.numero_bracelet}`);
                  console.log("form", Object.fromEntries(form));
                  sviCarcasseFetcher.submit(form, {
                    method: "POST",
                    preventScrollReset: true,
                  });
                },
              }}
            />
          </div>
          <input
            form={`svi-carcasse-${carcasse.numero_bracelet}`}
            type="hidden"
            name={Prisma.CarcasseScalarFieldEnum.svi_carcasse_saisie_at}
            value={new Date().toISOString()}
          />
          <div className="flex flex-col items-start bg-white pl-2 [&_ul]:md:min-w-96">
            <ButtonsGroup
              buttons={
                !motifsSaisie.length ||
                JSON.stringify(carcasse.svi_carcasse_saisie_motif) !== JSON.stringify(motifsSaisie)
                  ? [
                      {
                        children: "Saisir",
                        type: "submit",
                        nativeButtonProps: {
                          onClick: (e) => {
                            if (!motifsSaisie.length) {
                              e.preventDefault();
                              alert("Veuillez ajouter au moins un motif de saisie");
                              return;
                            }
                          },
                          form: `svi-carcasse-${carcasse.numero_bracelet}`,
                          name: Prisma.CarcasseScalarFieldEnum.svi_carcasse_saisie_at,
                          suppressHydrationWarning: true,
                          value: dayjs().toISOString(),
                        },
                      },
                      {
                        children: "Annuler",
                        priority: "secondary",
                        type: "button",
                        nativeButtonProps: {
                          onClick: () => {
                            setShowSaisir(false);
                            setMotifsSaisie([]);
                            const form = new FormData();
                            form.append(Prisma.CarcasseScalarFieldEnum.svi_carcasse_commentaire, "");
                            form.append(Prisma.CarcasseScalarFieldEnum.svi_carcasse_saisie_motif, "");
                            form.append(Prisma.CarcasseScalarFieldEnum.svi_carcasse_saisie, "false");
                            form.append(Prisma.CarcasseScalarFieldEnum.svi_carcasse_saisie_at, "");
                            form.append(Prisma.CarcasseScalarFieldEnum.fei_numero, fei.numero);
                            form.append("route", `/api/fei-carcasse/${fei.numero}/${carcasse.numero_bracelet}`);
                            sviCarcasseFetcher.submit(form, {
                              method: "POST",
                              preventScrollReset: true,
                            });
                          },
                        },
                      },
                    ]
                  : [
                      {
                        children: "Annuler",
                        priority: "secondary",
                        type: "button",
                        nativeButtonProps: {
                          onClick: () => setShowSaisir(false),
                        },
                      },
                    ]
              }
            />
          </div>
        </sviCarcasseFetcher.Form>
      )}
    </div>
  );
}
