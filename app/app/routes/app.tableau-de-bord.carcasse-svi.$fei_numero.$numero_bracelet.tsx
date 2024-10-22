import { useFetcher, useLoaderData, useParams } from "@remix-run/react";
import { useMemo, useState } from "react";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { Prisma, CarcasseType, UserRoles } from "@prisma/client";
import saisieSvi from "@app/data/saisie-svi.json";
import dayjs from "dayjs";
import { ButtonsGroup } from "@codegouvfr/react-dsfr/ButtonsGroup";
import InputForSearchPrefilledData from "@app/components/InputForSearchPrefilledData";
import {
  clientLoader as feiClientLoader,
  clientAction as feiClientAction,
} from "@app/routes/app.tableau-de-bord.fei.$fei_numero/route";
import CarcasseSVI from "@app/routes/app.tableau-de-bord.fei.$fei_numero/carcasse-svi";
import { Breadcrumb } from "@codegouvfr/react-dsfr/Breadcrumb";
import { Accordion } from "@codegouvfr/react-dsfr/Accordion";
import InputNotEditable from "@app/components/InputNotEditable";
import Notice from "@codegouvfr/react-dsfr/Notice";

// export clientLoader being feiClientLoader
export const clientAction = feiClientAction;
export const clientLoader = feiClientLoader;

export default function CarcasseEditSVI() {
  const {
    user,
    fei,
    examinateurInitialUser,
    premierDetenteurUser,
    premierDetenteurEntity,
    carcasses,
    inetermediairesPopulated,
  } = useLoaderData<typeof feiClientLoader>();
  const params = useParams();
  const carcasse = useMemo(() => {
    return carcasses.find((c) => c.numero_bracelet === params.numero_bracelet)!;
  }, [carcasses, params]);
  const sviCarcasseFetcher = useFetcher({ key: `svi-carcasse-${carcasse.numero_bracelet}` });

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

  const examinateurInitialInput = useMemo(() => {
    const lines = [];
    lines.push(`${examinateurInitialUser?.prenom} ${examinateurInitialUser?.nom_de_famille}`);
    lines.push(examinateurInitialUser?.telephone);
    lines.push(examinateurInitialUser?.email);
    lines.push(examinateurInitialUser?.numero_cfei);
    lines.push(`${examinateurInitialUser?.code_postal} ${examinateurInitialUser?.ville}`);
    return lines;
  }, [examinateurInitialUser]);

  const premierDetenteurInput = useMemo(() => {
    const lines = [];
    if (premierDetenteurEntity) {
      lines.push(premierDetenteurEntity.raison_sociale);
      lines.push(premierDetenteurEntity.siret);
      lines.push(`${premierDetenteurEntity.code_postal} ${premierDetenteurEntity.ville}`);
      return lines;
    }
    lines.push(`${premierDetenteurUser?.prenom} ${premierDetenteurUser?.nom_de_famille}`);
    lines.push(premierDetenteurUser?.telephone);
    lines.push(premierDetenteurUser?.email);
    lines.push(premierDetenteurUser?.numero_cfei);
    lines.push(`${premierDetenteurUser?.code_postal} ${premierDetenteurUser?.ville}`);
    return lines;
  }, [premierDetenteurEntity, premierDetenteurUser]);

  const [motifsSaisie, setMotifsSaisie] = useState(carcasse?.svi_carcasse_saisie_motif?.filter(Boolean) ?? []);

  const canEdit = useMemo(() => {
    if (fei.fei_current_owner_user_id !== user.id) {
      return false;
    }
    if (fei.svi_signed_at) {
      return false;
    }
    if (fei.fei_current_owner_role !== UserRoles.SVI) {
      return false;
    }
    return true;
  }, [fei, user]);

  return (
    <div className="fr-container fr-container--fluid fr-my-md-14v">
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
          <h1 className="fr-h2 fr-mb-2w">{carcasse.numero_bracelet}</h1>
          <p>
            {carcasse.type === CarcasseType.PETIT_GIBIER
              ? "Lot de carcasses de petit gibier"
              : "Carcasse de grand gibier"}
          </p>
          <Breadcrumb
            currentPageLabel={`Carcasse ${carcasse.numero_bracelet}`}
            segments={[
              {
                label: "Mon tableau de bord",
                linkProps: {
                  to: "/app/tableau-de-bord",
                  href: "#",
                },
              },
              {
                label: fei.numero,
                linkProps: {
                  to: `/app/tableau-de-bord/fei/${fei.numero}`,
                  href: "#",
                },
              },
            ]}
          />
          <div className="mb-6 bg-white py-2 md:shadow">
            <div className="p-4 pb-8 md:p-8 md:pb-4">
              <Accordion
                titleAs="h2"
                defaultExpanded={false}
                label={`Infos sur la chasse et ${carcasse.type === CarcasseType.PETIT_GIBIER ? "le lot de carcasses" : "la carcasse"} 🔒`}
              >
                <>
                  <div className="fr-fieldset__element">
                    <InputNotEditable
                      label="Espèce"
                      nativeInputProps={{
                        defaultValue: carcasse.espece!,
                      }}
                    />
                  </div>
                  <div className="fr-fieldset__element">
                    <InputNotEditable
                      label="Nombre d'animaux initialement prélevés"
                      nativeInputProps={{
                        defaultValue: carcasse.nombre_d_animaux!,
                      }}
                    />
                  </div>
                  <div className="fr-fieldset__element">
                    <InputNotEditable
                      label="Commentaires des destinataires"
                      textArea
                      nativeTextAreaProps={{
                        rows: commentairesIntermediaires.length,
                        defaultValue: commentairesIntermediaires.join("\n"),
                      }}
                    />
                  </div>
                  <div className="fr-fieldset__element">
                    <InputNotEditable
                      label="Examinateur Initial"
                      textArea
                      nativeTextAreaProps={{
                        rows: examinateurInitialInput.length,
                        defaultValue: examinateurInitialInput.join("\n"),
                      }}
                    />
                  </div>
                  <div className="fr-fieldset__element">
                    <InputNotEditable
                      label="Premier Détenteur"
                      textArea
                      nativeTextAreaProps={{
                        rows: premierDetenteurInput.length,
                        defaultValue: premierDetenteurInput.join("\n"),
                      }}
                    />
                  </div>
                </>
              </Accordion>
              {canEdit && (
                <Accordion titleAs="h2" defaultExpanded label="Saisie">
                  <>
                    {motifsSaisie.map((motif, index) => {
                      return (
                        <Notice
                          isClosable
                          key={motif + index}
                          title={motif}
                          onClose={() => {
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
                              form.append(Prisma.CarcasseScalarFieldEnum.svi_carcasse_saisie_at, dayjs().toISOString());
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
                        />
                      );
                    })}
                  </>
                  <sviCarcasseFetcher.Form method="POST" id={`svi-carcasse-${carcasse.numero_bracelet}`}>
                    <input
                      type="hidden"
                      name="route"
                      value={`/api/fei-carcasse/${fei.numero}/${carcasse.numero_bracelet}`}
                    />
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
                              ]
                            : [
                                {
                                  children: "Annuler la saisie",
                                  priority: "secondary",
                                  type: "button",
                                  nativeButtonProps: {
                                    onClick: () => {
                                      setMotifsSaisie([]);
                                      const form = new FormData();
                                      form.append(Prisma.CarcasseScalarFieldEnum.svi_carcasse_commentaire, "");
                                      form.append(Prisma.CarcasseScalarFieldEnum.svi_carcasse_saisie_motif, "");
                                      form.append(Prisma.CarcasseScalarFieldEnum.svi_carcasse_saisie, "false");
                                      form.append(Prisma.CarcasseScalarFieldEnum.svi_carcasse_saisie_at, "");
                                      form.append(Prisma.CarcasseScalarFieldEnum.fei_numero, fei.numero);
                                      form.append(
                                        "route",
                                        `/api/fei-carcasse/${fei.numero}/${carcasse.numero_bracelet}`,
                                      );
                                      sviCarcasseFetcher.submit(form, {
                                        method: "POST",
                                        preventScrollReset: true,
                                      });
                                    },
                                  },
                                },
                              ]
                        }
                      />
                    </div>
                  </sviCarcasseFetcher.Form>
                </Accordion>
              )}
              <Accordion titleAs="h2" defaultExpanded label="Résumé affiché dans la FEI 🔒">
                <CarcasseSVI carcasse={carcasse} canEdit={false} key={carcasse.updated_at} />
              </Accordion>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
