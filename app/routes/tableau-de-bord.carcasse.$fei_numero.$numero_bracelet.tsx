import { useFetcher, useLoaderData } from "@remix-run/react";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { ButtonsGroup } from "@codegouvfr/react-dsfr/ButtonsGroup";
import { Prisma } from "@prisma/client";
import grandGibier from "~/data/grand-gibier.json";
import grandGibierCarcasse from "~/data/grand-gibier-carcasse.json";
import grandGibierAbats from "~/data/grand-gibier-abats.json";
import { useEffect, useMemo, useRef, useState } from "react";
import InputForSearchPrefilledData from "~/components/InputForSearchPrefilledData";
import { json, redirect, type LoaderFunctionArgs } from "@remix-run/node";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { prisma } from "~/db/prisma.server";
import { getUserFromCookie } from "~/services/auth.server";
import InputNotEditable from "~/components/InputNotEditable";
import { Notice } from "@codegouvfr/react-dsfr/Notice";
import { Breadcrumb } from "@codegouvfr/react-dsfr/Breadcrumb";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const user = await getUserFromCookie(request);
  if (!user) {
    throw redirect("/connexion?type=compte-existant");
  }
  const carcasse = await prisma.carcasse.findUnique({
    where: {
      numero_bracelet: params.numero_bracelet,
      fei_numero: params.fei_numero,
    },
    include: {
      Fei: true,
    },
  });
  if (!carcasse) {
    throw redirect(`/tableau-de-bord/fei/${params.fei_numero}`);
  }

  return json({ carcasse, user, fei: carcasse.Fei });
}

export default function CarcasseReadAndWrite() {
  const { fei, carcasse, user } = useLoaderData<typeof loader>();
  const canEdit = useMemo(() => {
    if (fei.examinateur_initial_user_id !== user.id) {
      return false;
    }
    if (fei.examinateur_initial_approbation_mise_sur_le_marche) {
      return false;
    }
    return true;
  }, [fei, user]);

  const Component = canEdit ? Input : InputNotEditable;

  const carcasseFetcher = useFetcher({ key: "carcasse-edit-fetcher" });
  const [espece, setEspece] = useState(carcasse.espece);
  const [categorie, setCategorie] = useState(carcasse.categorie);
  const [anomaliesAbats, setAnomaliesAbats] = useState<Array<string>>(carcasse.examinateur_anomalies_abats);
  const [anomaliesCarcasse, setAnomaliesCarcasse] = useState<Array<string>>(carcasse.examinateur_anomalies_carcasse);
  const [addAnomalieAbats, setAddAnomalieAbats] = useState(false);
  const [addAnomalieCarcasse, setAddAnomalieCarcasse] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);

  const handleFormSubmit = () => {
    const formData = new FormData(formRef.current!);
    carcasseFetcher.submit(formData, {
      method: "POST",
      action: `/action/carcasse/${carcasse.numero_bracelet}`,
      preventScrollReset: true, // Prevent scroll reset on submission
    });
  };

  useEffect(() => {
    handleFormSubmit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [espece, categorie, anomaliesAbats, anomaliesCarcasse]);

  return (
    <div className="fr-container fr-container--fluid fr-my-md-14v">
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
          <h1 className="fr-h2 fr-mb-2w">Carcasse Grand Gibier</h1>
          <Breadcrumb
            currentPageLabel={`Carcasse ${carcasse.numero_bracelet}`}
            segments={[
              {
                label: "Mon tableau de bord",
                linkProps: {
                  to: "/tableau-de-bord",
                  href: "#",
                },
              },
              {
                label: fei.numero,
                linkProps: {
                  to: `/tableau-de-bord/fei/${fei.numero}`,
                  href: "#",
                },
              },
            ]}
          />
          <carcasseFetcher.Form
            id="carcasse-edit-form"
            method="POST"
            ref={formRef}
            onChange={handleFormSubmit}
            action={`/action/carcasse/${carcasse.numero_bracelet}`}
            className="mb-6 bg-white py-2 md:shadow"
          >
            <div className="p-4 pb-8 md:p-8 md:pb-4">
              <input type="hidden" name={Prisma.CarcasseScalarFieldEnum.fei_numero} value={fei.numero} />
              <input type="hidden" name={Prisma.CarcasseScalarFieldEnum.espece} value={espece || ""} />
              <input type="hidden" name={Prisma.CarcasseScalarFieldEnum.categorie} value={categorie || ""} />
              <input
                type="hidden"
                name={Prisma.CarcasseScalarFieldEnum.examinateur_carcasse_sans_anomalie}
                value={!anomaliesCarcasse?.length ? "true" : "false"}
              />
              <input
                type="hidden"
                name={Prisma.CarcasseScalarFieldEnum.examinateur_abats_sans_anomalie}
                value={!anomaliesAbats?.length ? "true" : "false"}
              />
              {anomaliesAbats?.map((anomalie, index) => (
                <input
                  key={anomalie + index}
                  type="hidden"
                  name={Prisma.CarcasseScalarFieldEnum.examinateur_anomalies_abats}
                  value={anomalie || ""}
                />
              ))}
              {anomaliesCarcasse?.map((anomalie, index) => (
                <input
                  key={anomalie + index}
                  type="hidden"
                  name={Prisma.CarcasseScalarFieldEnum.examinateur_anomalies_carcasse}
                  value={anomalie || ""}
                />
              ))}

              <div className="fr-fieldset__element">
                <InputNotEditable
                  label="Numéro de bracelet"
                  nativeInputProps={{
                    name: Prisma.CarcasseScalarFieldEnum.numero_bracelet,
                    defaultValue: carcasse.numero_bracelet,
                  }}
                />
              </div>
              <div className="fr-fieldset__element flex w-full flex-col items-stretch gap-4 md:flex-row md:items-end">
                <Component
                  label="Heure de la mise à mort"
                  className="!mb-0 grow"
                  nativeInputProps={{
                    type: "time",
                    name: Prisma.CarcasseScalarFieldEnum.heure_mise_a_mort,
                    defaultValue: carcasse.heure_mise_a_mort ?? "",
                  }}
                />
              </div>
              <div className="fr-fieldset__element flex w-full flex-col items-stretch gap-4 md:flex-row md:items-end">
                <Component
                  label="Heure de l'évisceration"
                  className="!mb-0 grow"
                  nativeInputProps={{
                    type: "time",
                    name: Prisma.CarcasseScalarFieldEnum.heure_evisceration,
                    defaultValue: carcasse.heure_evisceration ?? "",
                  }}
                />
              </div>
              <div className="fr-fieldset__element">
                <InputForSearchPrefilledData
                  canEdit={canEdit}
                  data={Object.keys(grandGibier.especes_categories)}
                  label="Sélectionnez l'espèce de la carcasse"
                  hintText=""
                  placeholder="Cerf, Sanglier..."
                  hideDataWhenNoSearch={false}
                  onSelect={setEspece}
                  defaultValue={espece ?? ""}
                />
              </div>

              <div className="fr-fieldset__element">
                <InputForSearchPrefilledData
                  canEdit={canEdit}
                  // @ts-expect-error we dont type this json
                  data={espece ? grandGibier.especes_categories[espece] : []}
                  label="Sélectionnez la catégorie de l'espèce"
                  hintText=""
                  hideDataWhenNoSearch={false}
                  // @ts-expect-error we dont type this json
                  placeholder={espece ? grandGibier.especes_categories[espece].join(", ") : ""}
                  onSelect={setCategorie}
                  defaultValue={categorie ?? ""}
                />
              </div>
            </div>
          </carcasseFetcher.Form>
          {espece && categorie && (
            <>
              <div className="mb-6 bg-white md:shadow">
                <div className="p-4 pb-8 md:p-8 md:pb-4">
                  <div className="fr-fieldset__element">
                    <h3 className="fr-h4 fr-mb-2w">
                      Anomalies carcasse<span className="fr-hint-text"></span>
                    </h3>
                    <div className="mt-4">
                      {anomaliesCarcasse.map((anomalie, index) => {
                        return (
                          // @ts-expect-error isClosable is of type `true` but we expect `boolean`
                          <Notice
                            className="fr-fieldset__element fr-text-default--grey fr-background-contrast--grey p-2 [&_p.fr-notice\\_\\_title]:before:hidden"
                            title={anomalie}
                            isClosable={canEdit}
                            onClose={() => setAnomaliesCarcasse(anomaliesCarcasse.filter((a) => a !== anomalie))}
                            key={anomalie + index}
                          />
                        );
                      })}
                      {!anomaliesCarcasse.length && <p className="fr-text--sm">Aucune anomalie carcasse.</p>}
                    </div>
                    {canEdit && (
                      <>
                        <div className="mt-2">
                          <Button onClick={() => setAddAnomalieCarcasse(true)} type="button" iconId="ri-add-box-fill">
                            Ajouter une anomalie carcasse
                          </Button>
                        </div>
                        {addAnomalieCarcasse && (
                          <div className="fr-fieldset__element mt-4">
                            <InputForSearchPrefilledData
                              canEdit={canEdit}
                              data={grandGibierCarcasse}
                              label="Sélectionnez l'anomalie de la carcasse"
                              hintText=""
                              hideDataWhenNoSearch
                              onSelect={(newAnomalie) => {
                                setAddAnomalieCarcasse(false);
                                setAnomaliesCarcasse([...anomaliesCarcasse, newAnomalie]);
                              }}
                            />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="mb-6 bg-white md:shadow">
                <div className="p-4 pb-8 md:p-8 md:pb-4">
                  <div className="fr-fieldset__element">
                    <h3 className="fr-h4 fr-mb-2w">
                      Anomalies abat<span className="fr-hint-text"></span>
                    </h3>
                    <div className="mt-4">
                      {anomaliesAbats.map((anomalie, index) => {
                        return (
                          // @ts-expect-error isClosable is of type `true` but we expect `boolean`
                          <Notice
                            className="fr-fieldset__element fr-text-default--grey fr-background-contrast--grey p-2 [&_p.fr-notice\\_\\_title]:before:hidden"
                            title={anomalie}
                            isClosable={canEdit}
                            onClose={() => setAnomaliesCarcasse(anomaliesAbats.filter((a) => a !== anomalie))}
                            key={anomalie + index}
                          />
                        );
                      })}
                      {!anomaliesAbats.length && <p className="fr-text--sm">Aucune anomalie abat.</p>}
                    </div>
                    {canEdit && (
                      <>
                        <div className="mt-2">
                          <Button onClick={() => setAddAnomalieCarcasse(true)} type="button" iconId="ri-add-box-fill">
                            Ajouter une anomalie abat
                          </Button>
                        </div>
                        {addAnomalieAbats && (
                          <div className="fr-fieldset__element">
                            <InputForSearchPrefilledData
                              data={grandGibierAbats}
                              label="Sélectionnez l'anomalie des abats"
                              hintText=""
                              hideDataWhenNoSearch
                              onSelect={(newAnomalie) => {
                                setAddAnomalieAbats(false);
                                setAnomaliesAbats([...anomaliesAbats, newAnomalie]);
                              }}
                            />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
          <div className="fixed bottom-0 left-0 z-50 flex w-full flex-col bg-white p-6 pb-2 shadow-2xl md:relative md:w-auto md:items-center md:shadow-none [&_ul]:md:min-w-96">
            <ButtonsGroup
              buttons={[
                {
                  children: "Retourner à la FEI",
                  priority: "tertiary",
                  linkProps: {
                    to: `/tableau-de-bord/fei/${fei.numero}`,
                    href: "#",
                  },
                },
              ]}
            />
          </div>
        </div>
      </div>
    </div>
  );
}