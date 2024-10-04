import {
  json,
  redirect,
  type ClientLoaderFunctionArgs,
  type ClientActionFunctionArgs,
  useFetcher,
  useLoaderData,
} from "@remix-run/react";
import { ButtonsGroup } from "@codegouvfr/react-dsfr/ButtonsGroup";
import { Prisma } from "@prisma/client";
import grandGibier from "~/data/grand-gibier.json";
import grandGibierCarcasseList from "~/data/grand-gibier-carcasse/list.json";
import grandGibierCarcasseTree from "~/data/grand-gibier-carcasse/tree.json";
import grandGibierAbatstree from "~/data/grand-gibier-abats/tree.json";
import grandGibierAbatsList from "~/data/grand-gibier-abats/list.json";
import { useEffect, useMemo, useRef, useState } from "react";
import InputForSearchPrefilledData from "~/components/InputForSearchPrefilledData";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { Checkbox } from "@codegouvfr/react-dsfr/Checkbox";
import { Select } from "@codegouvfr/react-dsfr/Select";
import { Notice } from "@codegouvfr/react-dsfr/Notice";
import { Breadcrumb } from "@codegouvfr/react-dsfr/Breadcrumb";
import { Button } from "@codegouvfr/react-dsfr/Button";
import InputNotEditable from "~/components/InputNotEditable";
import { type CarcasseLoaderData } from "~/routes/api.loader.carcasse.$fei_numero.$numero_bracelet";
import { type CarcasseActionData } from "~/routes/api.action.carcasse.$numero_bracelet";
import { getMostFreshUser } from "~/utils-offline/get-most-fresh-user";
import { createModal } from "@codegouvfr/react-dsfr/Modal";
import ModalTreeDisplay from "~/components/ModalTreeDisplay";
import { useIsOnline } from "~/components/OfflineMode";

export async function clientAction({ request, params }: ClientActionFunctionArgs) {
  const formData = await request.formData();
  console.log("carcasse formdata", Object.fromEntries(formData.entries()));
  const response = (await fetch(`${import.meta.env.VITE_API_URL}/api/action/carcasse/${params.numero_bracelet}`, {
    method: "POST",
    credentials: "include",
    body: formData,
    headers: {
      Accept: "application/json",
    },
  }).then((response) => response.json())) as CarcasseActionData;
  if (response.ok && response.data && response.data.numero_bracelet !== params.numero_bracelet) {
    throw redirect(`/app/tableau-de-bord/carcasse/${params.fei_numero}/${response.data.numero_bracelet}`);
  }
  return response;
}

export async function clientLoader({ params }: ClientLoaderFunctionArgs) {
  const user = await getMostFreshUser();
  if (!user) {
    throw redirect(`/app/connexion?type=compte-existant`);
  }
  const response = (await fetch(
    `${import.meta.env.VITE_API_URL}/api/loader/carcasse/${params.fei_numero}/${params.numero_bracelet}`,
    {
      method: "GET",
      credentials: "include",
      headers: new Headers({
        Accept: "application/json",
        "Content-Type": "application/json",
      }),
    },
  ).then((res) => res.json())) as CarcasseLoaderData;

  if (!response?.ok) {
    throw redirect(`/app/tableau-de-bord/fei/${params.fei_numero}`);
  }

  return json({ carcasse: response.data!.carcasse!, user, fei: response.data!.fei! });
}

const anomaliesAbatsModal = createModal({
  isOpenedByDefault: false,
  id: "anomalie-abats-modal-carcasse",
});

const anomaliesCarcasseModal = createModal({
  isOpenedByDefault: false,
  id: "anomalie-carcasse-modal-carcasse",
});

export default function CarcasseReadAndWrite() {
  const { fei, carcasse, user } = useLoaderData<typeof clientLoader>();
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
  const isOnline = useIsOnline();

  const numeroFetcher = useFetcher({ key: "carcasse-numero-edit-fetcher" });
  const noAnomalieFetcher = useFetcher({ key: "carcasse-no-anomalie-fetcher" });
  const carcasseFetcher = useFetcher({ key: "carcasse-edit-fetcher" });
  const [espece, setEspece] = useState(carcasse.espece || "");
  const [categorie, setCategorie] = useState(carcasse.categorie || "");
  const [showAsSelectOption, setShowAsSelectOption] = useState(false);
  const [anomaliesAbats, setAnomaliesAbats] = useState<Array<string>>(carcasse.examinateur_anomalies_abats || []);
  const [anomaliesCarcasse, setAnomaliesCarcasse] = useState<Array<string>>(
    carcasse.examinateur_anomalies_carcasse || [],
  );
  const [noANomalie, setNoAnomalie] = useState(carcasse.examinateur_carcasse_sans_anomalie || false);
  // const [addAnomalieAbats, setAddAnomalieAbats] = useState(true);
  // const [addAnomalieCarcasse, setAddAnomalieCarcasse] = useState(true);
  const addAnomalieAbats = true;
  const addAnomalieCarcasse = true;
  const [showScroll, setShowScroll] = useState(
    canEdit && espece && !anomaliesAbats.length && !anomaliesCarcasse.length,
  );

  const numeroFormRef = useRef<HTMLFormElement>(null);
  const noAnomalieFormRef = useRef<HTMLFormElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const handleFormSubmit = () => {
    const formData = new FormData(formRef.current!);
    formData.append(Prisma.CarcasseScalarFieldEnum.examinateur_signed_at, new Date().toISOString());
    carcasseFetcher.submit(formData, {
      method: "POST",
      preventScrollReset: true, // Prevent scroll reset on submission
    });
  };

  useEffect(() => {
    handleFormSubmit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [espece, categorie, anomaliesAbats, anomaliesCarcasse]);

  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight) {
        setShowScroll(false);
      }
    };
    if (showScroll) {
      // on window scroll to bottom, hide the button
      window.addEventListener("scroll", handleScroll);
    }
    return () => window.removeEventListener("scroll", handleScroll);
  }, [showScroll]);

  function PermanentFields() {
    return (
      <>
        <input type="hidden" name={Prisma.CarcasseScalarFieldEnum.fei_numero} value={fei.numero} />
        <input type="hidden" name={Prisma.CarcasseScalarFieldEnum.espece} value={espece || ""} />
        <input type="hidden" name={Prisma.CarcasseScalarFieldEnum.categorie} value={categorie || ""} />
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
        {(anomaliesAbats.length > 0 || anomaliesCarcasse.length > 0) && (
          <input type="hidden" name={Prisma.CarcasseScalarFieldEnum.examinateur_carcasse_sans_anomalie} value="false" />
        )}
      </>
    );
  }

  const NumeroBraceletComponent = isOnline ? Input : InputNotEditable;

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
          {canEdit && (
            <numeroFetcher.Form
              id="carcasse-edit-form"
              method="POST"
              ref={numeroFormRef}
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(numeroFormRef.current!);
                formData.append(Prisma.CarcasseScalarFieldEnum.examinateur_signed_at, new Date().toISOString());
                numeroFetcher.submit(formData, {
                  method: "POST",
                  preventScrollReset: true, // Prevent scroll reset on submission
                });
              }}
              className="mb-6 bg-white py-2 md:shadow"
            >
              <div className="p-4">
                <div className="fr-fieldset__element">
                  <PermanentFields />
                  <NumeroBraceletComponent
                    label="Numéro de bracelet"
                    nativeInputProps={{
                      type: "text",
                      name: Prisma.CarcasseScalarFieldEnum.numero_bracelet,
                      defaultValue: carcasse.numero_bracelet,
                    }}
                  />
                </div>
                <div className="fr-fieldset__element m-0 flex justify-end">
                  <Button type="submit">Modifier</Button>
                </div>
              </div>
            </numeroFetcher.Form>
          )}
          <carcasseFetcher.Form
            id="carcasse-edit-form"
            method="POST"
            ref={formRef}
            onChange={handleFormSubmit}
            className="mb-6 bg-white py-2 md:shadow"
          >
            <div className="p-4 pb-8 md:p-8 md:pb-4">
              <PermanentFields />
              {canEdit ? (
                <input
                  type="hidden"
                  name={Prisma.CarcasseScalarFieldEnum.numero_bracelet}
                  value={carcasse.numero_bracelet}
                />
              ) : (
                <div className="fr-fieldset__element">
                  <InputNotEditable
                    label="Numéro de bracelet"
                    nativeInputProps={{
                      type: "text",
                      name: Prisma.CarcasseScalarFieldEnum.numero_bracelet,
                      defaultValue: carcasse.numero_bracelet,
                    }}
                  />
                </div>
              )}
              <div className="flex flex-col gap-x-4 md:flex-row">
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
              </div>
              <div className="fr-fieldset__element">
                <input type="hidden" name="espece" value={espece ?? ""} />
                <input type="hidden" name="categorie" value={categorie ?? ""} />
                <Select
                  label="Sélectionnez l'espèce et la catégorie du gibier"
                  className="group !mb-0 grow"
                  nativeSelectProps={{
                    name: Prisma.FeiScalarFieldEnum.fei_next_owner_role,
                    value: `${espece}__${categorie}`,
                    onClick: () => {
                      setShowAsSelectOption(true);
                    },
                    onBlur: () => {
                      setShowAsSelectOption(false);
                    },
                    onChange: (e) => {
                      const espece__categorie = e.currentTarget.value;
                      const [newEspece, newCategorie] = espece__categorie.split("__");
                      setShowAsSelectOption(false);
                      setEspece(newEspece);
                      setCategorie(newCategorie);
                      if (!espece || !anomaliesAbats.length || !anomaliesCarcasse.length) {
                        setShowScroll(true);
                      }
                    },
                  }}
                >
                  <option value="">Sélectionnez l'espèce et la catégorie du gibier</option>
                  <hr />
                  {Object.entries(grandGibier.especes_categories).map(([_espece, _categories]) => {
                    return (
                      <optgroup label={_espece} key={_espece}>
                        {_categories.map((_categorie: string) => {
                          return (
                            <option key={`${_espece}__${_categorie}`} value={`${_espece}__${_categorie}`}>
                              {showAsSelectOption ? _categorie : `${_espece} - ${_categorie}`}
                            </option>
                          );
                        })}
                      </optgroup>
                    );
                  })}
                </Select>
              </div>
              {/* <div className="fr-fieldset__element">
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
                  data={grandGibier.especes_categories[espece] ?? []}
                  label="Sélectionnez la catégorie de l'espèce"
                  hintText=""
                  hideDataWhenNoSearch={false}
                  // @ts-expect-error we dont type this json
                  placeholder={espece ? grandGibier.especes_categories[espece]?.join(", ") : ""}
                  onSelect={setCategorie}
                  defaultValue={categorie ?? ""}
                />
              </div> */}
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
                        {/* <div className="mt-2">
                          <Button onClick={() => setAddAnomalieCarcasse(true)} type="button" iconId="ri-add-box-fill">
                            Ajouter une anomalie carcasse
                          </Button>
                        </div> */}
                        {addAnomalieCarcasse && (
                          <div className="fr-fieldset__element mt-4">
                            <InputForSearchPrefilledData
                              canEdit={canEdit}
                              data={grandGibierCarcasseList}
                              clearInputOnClick
                              label="Ajouter une nouvelle anomalie"
                              hintText={
                                <>
                                  Voir le référentiel des anomalies de carcasse en{" "}
                                  <button
                                    type="button"
                                    className="underline"
                                    onClick={() => anomaliesCarcasseModal.open()}
                                  >
                                    cliquant ici
                                  </button>
                                </>
                              }
                              hideDataWhenNoSearch
                              onSelect={(newAnomalie) => {
                                // setAddAnomalieCarcasse(false);
                                setAnomaliesCarcasse([...anomaliesCarcasse, newAnomalie]);
                              }}
                            />
                            <ModalTreeDisplay
                              data={grandGibierCarcasseTree}
                              modal={anomaliesCarcasseModal}
                              title="Anomalies carcasse"
                              onItemClick={(newAnomalie) => {
                                // setAddAnomalieCarcasse(false);
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
                            onClose={() => setAnomaliesAbats(anomaliesAbats.filter((a) => a !== anomalie))}
                            key={anomalie + index}
                          />
                        );
                      })}
                      {!anomaliesAbats.length && <p className="fr-text--sm">Aucune anomalie abat.</p>}
                    </div>
                    {canEdit && (
                      <>
                        {/* <div className="mt-2">
                          <Button onClick={() => setAddAnomalieAbats(true)} type="button" iconId="ri-add-box-fill">
                            Ajouter une anomalie abat
                          </Button>
                        </div> */}
                        {addAnomalieAbats && (
                          <div className="fr-fieldset__element mt-4">
                            <InputForSearchPrefilledData
                              data={grandGibierAbatsList}
                              label="Ajouter une nouvelle anomalie"
                              clearInputOnClick
                              hintText={
                                <>
                                  Voir le référentiel des anomalies d'abats en{" "}
                                  <button
                                    type="button"
                                    className="underline"
                                    onClick={() => anomaliesAbatsModal.open()}
                                  >
                                    cliquant ici
                                  </button>
                                </>
                              }
                              hideDataWhenNoSearch
                              onSelect={(newAnomalie) => {
                                // setAddAnomalieAbats(false);
                                setAnomaliesAbats([...anomaliesAbats, newAnomalie]);
                              }}
                            />
                            <ModalTreeDisplay
                              data={grandGibierAbatstree}
                              modal={anomaliesAbatsModal}
                              title="Anomalies abats"
                              onItemClick={(newAnomalie) => {
                                // setAddAnomalieAbats(false);
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
              {anomaliesAbats.length === 0 && anomaliesCarcasse.length === 0 && (
                <div className="mb-6 bg-white md:shadow">
                  <noAnomalieFetcher.Form
                    className="p-4 pb-8 md:p-8 md:pb-4"
                    method="POST"
                    ref={noAnomalieFormRef}
                    onSubmit={(e) => {
                      e.preventDefault();
                      const formData = new FormData(noAnomalieFormRef.current!);
                      formData.append(Prisma.CarcasseScalarFieldEnum.examinateur_signed_at, new Date().toISOString());
                      noAnomalieFetcher.submit(formData, {
                        method: "POST",
                        preventScrollReset: true, // Prevent scroll reset on submission
                      });
                    }}
                  >
                    <div className={["fr-fieldset__element", !canEdit ? "pointer-events-none" : ""].join(" ")}>
                      <PermanentFields />
                      <input
                        type="hidden"
                        name={Prisma.CarcasseScalarFieldEnum.numero_bracelet}
                        value={carcasse.numero_bracelet}
                      />
                      <Checkbox
                        options={[
                          {
                            label: `${
                              carcasse.examinateur_carcasse_sans_anomalie ? "J'ai certifié" : "Je certifie"
                            } ne constater aucune anomalie sur la carcasse`,
                            hintText:
                              "Attention, les anomalies que vous omettez seront détectées par le collecteur et l’ETG et augmente significativement le taux de saisie. Une anomalie déclarée c’est moins de gâchis.",
                            nativeInputProps: {
                              required: true,
                              name: Prisma.CarcasseScalarFieldEnum.examinateur_carcasse_sans_anomalie,
                              value: "true",
                              readOnly: !canEdit,
                              checked: !!noANomalie,
                              onChange: (e) => {
                                setNoAnomalie(e.target.checked);
                              },
                            },
                          },
                        ]}
                      />
                      {canEdit && carcasse.examinateur_carcasse_sans_anomalie !== noANomalie && (
                        <Button type="submit">Enregistrer</Button>
                      )}
                    </div>
                  </noAnomalieFetcher.Form>
                </div>
              )}
            </>
          )}
          <div className="fixed bottom-0 left-0 z-50 flex w-full flex-col shadow-2xl md:relative md:w-auto md:items-center md:shadow-none [&_ul]:md:min-w-96">
            {showScroll && (
              <div className="w-full p-6 pb-2 md:hidden">
                <button
                  type="button"
                  className="ml-auto block rounded-full bg-white px-4 py-1 shadow-lg"
                  onClick={() => {
                    window.scrollTo({ top: window.innerHeight, behavior: "smooth" });
                    setShowScroll(false);
                  }}
                >
                  ⬇️ Anomalies
                </button>
              </div>
            )}
            <div className="w-full bg-white p-6 pb-2">
              <ButtonsGroup
                buttons={[
                  {
                    children: canEdit ? "Enregistrer et retourner à la FEI" : "Retourner à la FEI",
                    linkProps: {
                      to: `/app/tableau-de-bord/fei/${fei.numero}`,
                      href: "#",
                    },
                  },
                ]}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
