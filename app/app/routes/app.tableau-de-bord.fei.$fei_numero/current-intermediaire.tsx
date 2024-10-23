import { Fragment, useMemo, useState } from "react";
import { useFetcher, useLoaderData } from "@remix-run/react";
import { clientLoader } from "./route";
import { Prisma, CarcasseIntermediaire, Carcasse } from "@prisma/client";
import InputNotEditable from "@app/components/InputNotEditable";
import { Accordion } from "@codegouvfr/react-dsfr/Accordion";
import { Checkbox } from "@codegouvfr/react-dsfr/Checkbox";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { Input } from "@codegouvfr/react-dsfr/Input";
import dayjs from "dayjs";
import SelectNextOwner from "./select-next-owner";
import CarcasseIntermediaireComp from "./carcasse-intermediaire";
import type { SerializeFrom } from "@remix-run/node";
import EntityNotEditable from "@app/components/EntityNotEditable";
import { mergeFeiIntermediaire } from "@app/db/fei-intermediaire.client";

export default function FEICurrentIntermediaire() {
  const { fei, user, inetermediairesPopulated, carcasses } = useLoaderData<typeof clientLoader>();

  const [intermediaireIndex, setIntermediaireIndex] = useState(0);
  const intermediaire = inetermediairesPopulated[intermediaireIndex];
  const priseEnChargeFetcher = useFetcher({ key: `prise-en-charge-${intermediaire.id}` });

  const canEdit = useMemo(() => {
    if (fei.fei_current_owner_user_id !== user.id) {
      return false;
    }
    if (!intermediaire) {
      return false;
    }
    if (intermediaire.fei_intermediaire_user_id !== user.id) {
      return false;
    }
    if (intermediaire.check_finished_at) {
      return false;
    }
    return true;
  }, [fei, user, intermediaire]);

  const PriseEnChargeInput = canEdit ? Input : InputNotEditable;

  const carcassesUnsorted = carcasses.filter((carcasse) => !!intermediaire.carcasses[carcasse.numero_bracelet]);
  const carcassesSorted = useMemo(() => {
    const intermediaireCheckById: Record<string, SerializeFrom<CarcasseIntermediaire>> = {};
    for (const intermediaireCheck of Object.values(intermediaire.carcasses).filter((c) => c != null)) {
      intermediaireCheckById[intermediaireCheck.fei_numero__bracelet__intermediaire_id] = intermediaireCheck;
    }
    const carcassesApproved: Record<string, SerializeFrom<Carcasse>> = {};
    const carcassesRejetees: Record<string, SerializeFrom<Carcasse>> = {};
    const carcassesManquantes: Record<string, SerializeFrom<Carcasse>> = {};
    // const carcassesToCheck: Record<string, SerializeFrom<Carcasse>> = {};
    for (const carcasse of carcassesUnsorted) {
      const checkId = `${fei.numero}__${carcasse.numero_bracelet}__${intermediaire.id}`;
      if (intermediaireCheckById[checkId]) {
        // console.log("intermediaireCheckById[checkId]", intermediaireCheckById[checkId]);
        if (intermediaireCheckById[checkId].prise_en_charge) {
          carcassesApproved[checkId] = carcasse;
        } else if (intermediaireCheckById[checkId].manquante) {
          // console.log("MANQUANTE ICI", intermediaireCheckById[checkId]);
          carcassesManquantes[checkId] = carcasse;
        } else {
          carcassesRejetees[checkId] = carcasse;
        }
      } else {
        if (carcasse.intermediaire_carcasse_refus_intermediaire_id) {
          if (carcasse.intermediaire_carcasse_refus_intermediaire_id === intermediaire.id) {
            if (carcasse.intermediaire_carcasse_manquante) {
              carcassesManquantes[checkId] = carcasse;
            } else {
              carcassesRejetees[checkId] = carcasse;
            }
          }
        } else {
          // carcassesToCheck[checkId] = carcasse;
        }
      }
    }
    return {
      carcassesApproved: Object.values(carcassesApproved),
      carcassesRejetees: Object.values(carcassesRejetees),
      carcassesManquantes: Object.values(carcassesManquantes),
      // carcassesToCheck: Object.values(carcassesToCheck),
    };
  }, [carcassesUnsorted, intermediaire, fei]);

  // const jobIsDone = carcassesSorted.carcassesToCheck.length === 0;
  const jobIsDone = true;

  const labelCheckDone = useMemo(() => {
    let label = `${intermediaire.check_finished_at ? "J'ai pris" : "Je prends"} en charge les carcasses que j'ai acceptées.`;
    const nbCarcassesValidated = carcassesSorted.carcassesApproved.length;
    if (nbCarcassesValidated > 0) {
      if (nbCarcassesValidated === 1) {
        label += " 1 carcasse/lot validé.";
      } else {
        label += ` ${nbCarcassesValidated} carcasses/lots validés.`;
      }
    }
    const nbCarcassesRejetees = carcassesSorted.carcassesRejetees.length;
    if (nbCarcassesRejetees > 0) {
      if (nbCarcassesRejetees === 1) {
        label += " 1 carcasse/lot rejeté.";
      } else {
        label += ` ${nbCarcassesRejetees} carcasses/lots rejetés.`;
      }
    }
    const nbCarcassesManquantes = carcassesSorted.carcassesManquantes.length;
    if (nbCarcassesManquantes > 0) {
      if (nbCarcassesManquantes === 1) {
        label += " 1 carcasse/lot manquant.";
      } else {
        label += ` ${nbCarcassesManquantes} carcasses/lots manquants.`;
      }
    }
    return label;
  }, [
    carcassesSorted.carcassesApproved.length,
    carcassesSorted.carcassesRejetees.length,
    carcassesSorted.carcassesManquantes.length,
    intermediaire.check_finished_at,
  ]);

  const needSelectNextUser = useMemo(() => {
    if (fei.fei_current_owner_user_id !== user.id) {
      return false;
    }
    if (!intermediaire.check_finished_at) {
      return false;
    }
    const latestIntermediaire = inetermediairesPopulated[0];
    if (latestIntermediaire.id !== intermediaire.id) {
      return false;
    }
    return true;
  }, [fei, user, intermediaire, inetermediairesPopulated]);

  // const prevCarcassesToCheckCount = useRef(carcassesSorted.carcassesToCheck.length);
  const [carcassesAValiderExpanded, setCarcassesAValiderExpanded] = useState(true);
  // const [carcassesAccepteesExpanded, setCarcassesAccepteesExpanded] = useState(false);
  // const [carcassesRefuseesExpanded, setCarcassesRefuseesExpanded] = useState(false);
  // const [carcassesManquantesExpanded, setCarcassesManquantesExpanded] = useState(false);

  // useEffect(() => {
  //   if (prevCarcassesToCheckCount.current > 0 && carcassesSorted.carcassesToCheck.length === 0) {
  //     setCarcassesAValiderExpanded(false);
  //     setCarcassesAccepteesExpanded(false);
  //     setCarcassesRefuseesExpanded(false);
  //   }
  //   prevCarcassesToCheckCount.current = carcassesSorted.carcassesToCheck.length;
  // }, [carcassesSorted.carcassesToCheck.length]);

  return (
    <>
      <nav
        id="fr-breadcrumb-:r54:"
        role="navigation"
        className="fr-breadcrumb"
        aria-label="vous êtes ici :"
        data-fr-js-breadcrumb="true"
      >
        <button
          className="fr-breadcrumb__button"
          aria-expanded="false"
          aria-controls="breadcrumb-:r55:"
          data-fr-js-collapse-button="true"
        >
          Voir les destinataires
        </button>
        <div className="fr-collapse" id="breadcrumb-:r55:" data-fr-js-collapse="true">
          <ol className="fr-breadcrumb__list">
            <li>
              <span className="fr-breadcrumb__link !bg-none !no-underline">Premier Détenteur</span>
            </li>
            {inetermediairesPopulated
              .map((_intermediaire, index) => {
                return (
                  <li key={_intermediaire.id}>
                    <button
                      onClick={() => setIntermediaireIndex(index)}
                      className="fr-breadcrumb__link"
                      aria-current={_intermediaire.id === intermediaire.id ? "step" : false}
                    >
                      {_intermediaire.entity?.nom_d_usage}
                    </button>
                  </li>
                );
              })
              .reverse()}
          </ol>
        </div>
      </nav>
      <Accordion titleAs="h3" label={`Identité de l'intermédaire ${canEdit ? "🔒" : ""}`}>
        <EntityNotEditable user={intermediaire.user!} entity={intermediaire.entity!} />
      </Accordion>
      {canEdit ? (
        <Accordion
          titleAs="h3"
          label={`Carcasses (${carcassesUnsorted.length})`}
          expanded={carcassesAValiderExpanded}
          onExpandedChange={setCarcassesAValiderExpanded}
        >
          {carcassesUnsorted.map((carcasse) => {
            return (
              <Fragment key={carcasse.numero_bracelet}>
                <CarcasseIntermediaireComp intermediaire={intermediaire} canEdit={canEdit} carcasse={carcasse} />
              </Fragment>
            );
          })}
        </Accordion>
      ) : (
        <>
          <Accordion
            titleAs="h3"
            label={`Carcasses acceptées (${carcassesSorted.carcassesApproved.length})`}
            // expanded={carcassesAccepteesExpanded}
            // onExpandedChange={setCarcassesAccepteesExpanded}
          >
            {carcassesSorted.carcassesApproved.length === 0 ? (
              <p>Pas de carcasse acceptée</p>
            ) : (
              carcassesSorted.carcassesApproved.map((carcasse) => {
                return (
                  <Fragment key={carcasse.numero_bracelet}>
                    <CarcasseIntermediaireComp intermediaire={intermediaire} canEdit={canEdit} carcasse={carcasse} />
                  </Fragment>
                );
              })
            )}
          </Accordion>
          <Accordion
            titleAs="h3"
            label={`Carcasses rejetées (${carcassesSorted.carcassesRejetees.length})`}
            // expanded={carcassesRefuseesExpanded}
            // onExpandedChange={setCarcassesRefuseesExpanded}
          >
            {carcassesSorted.carcassesRejetees.length === 0 ? (
              <p>Pas de carcasse refusée</p>
            ) : (
              carcassesSorted.carcassesRejetees.map((carcasse) => {
                return (
                  <Fragment key={carcasse.numero_bracelet}>
                    <CarcasseIntermediaireComp intermediaire={intermediaire} canEdit={canEdit} carcasse={carcasse} />
                  </Fragment>
                );
              })
            )}
          </Accordion>
          <Accordion
            titleAs="h3"
            label={`Carcasses manquantes (${carcassesSorted.carcassesManquantes.length})`}
            // expanded={carcassesRefuseesExpanded}
            // onExpandedChange={setCarcassesRefuseesExpanded}
          >
            {carcassesSorted.carcassesManquantes.length === 0 ? (
              <p>Pas de carcasse manquante</p>
            ) : (
              carcassesSorted.carcassesManquantes.map((carcasse) => {
                return (
                  <Fragment key={carcasse.numero_bracelet}>
                    <CarcasseIntermediaireComp intermediaire={intermediaire} canEdit={canEdit} carcasse={carcasse} />
                  </Fragment>
                );
              })
            )}
          </Accordion>
        </>
      )}
      <Accordion titleAs="h3" label="Prise en charge des carcasses acceptées" defaultExpanded key={intermediaire.id}>
        <priseEnChargeFetcher.Form
          method="POST"
          id="form_intermediaire_check_finished_at"
          onSubmit={(e) => {
            e.preventDefault();
            const nextFormIntermediaire = new FormData(e.currentTarget);
            const nextIntermediaire = mergeFeiIntermediaire(intermediaire, nextFormIntermediaire) as FormData;
            nextIntermediaire.append("route", `/api/fei-intermediaire/${fei.numero}/${intermediaire.id}`);
            priseEnChargeFetcher.submit(nextIntermediaire, {
              method: "POST",
              preventScrollReset: true,
            });
          }}
        >
          <input
            form="form_intermediaire_check_finished_at"
            type="hidden"
            name={Prisma.FeiScalarFieldEnum.numero}
            value={fei.numero}
          />
          <input
            form="form_intermediaire_check_finished_at"
            type="hidden"
            name={Prisma.FeiIntermediaireScalarFieldEnum.fei_numero}
            value={fei.numero}
          />
          <input
            form="form_intermediaire_check_finished_at"
            type="hidden"
            name={Prisma.FeiIntermediaireScalarFieldEnum.id}
            value={intermediaire.id}
          />
          <div
            className={["fr-fieldset__element", intermediaire.check_finished_at ? "pointer-events-none" : ""].join(" ")}
          >
            <Checkbox
              options={[
                {
                  label: labelCheckDone,
                  nativeInputProps: {
                    required: true,
                    name: Prisma.FeiIntermediaireScalarFieldEnum.check_finished_at,
                    value: "true",
                    disabled: !jobIsDone,
                    form: "form_intermediaire_check_finished_at",
                    readOnly: !!intermediaire.check_finished_at,
                    defaultChecked: intermediaire.check_finished_at ? true : false,
                  },
                },
              ]}
            />
            <div className="fr-fieldset__element">
              <PriseEnChargeInput
                label="Date de prise en charge"
                nativeInputProps={{
                  id: Prisma.FeiIntermediaireScalarFieldEnum.check_finished_at,
                  name: Prisma.FeiIntermediaireScalarFieldEnum.check_finished_at,
                  type: "datetime-local",
                  form: "form_intermediaire_check_finished_at",
                  suppressHydrationWarning: true,
                  autoComplete: "off",
                  defaultValue: dayjs(intermediaire.check_finished_at || undefined).format("YYYY-MM-DDTHH:mm"),
                }}
              />
            </div>
            {!intermediaire.check_finished_at && (
              <Button type="submit" disabled={!jobIsDone}>
                Enregistrer
              </Button>
            )}
          </div>
        </priseEnChargeFetcher.Form>
      </Accordion>

      {needSelectNextUser && (
        <div className="z-50 mt-8 flex flex-col bg-white pt-4 md:w-auto md:items-start [&_ul]:md:min-w-96">
          <SelectNextOwner />
        </div>
      )}
    </>
  );
}
