import { useEffect, useMemo, useRef, useState } from "react";
import { useFetcher, useLoaderData } from "@remix-run/react";
import { clientLoader } from "./route";
import { Prisma, CarcasseIntermediaire, Carcasse } from "@prisma/client";
import InputNotEditable from "~/components/InputNotEditable";
import { Accordion } from "@codegouvfr/react-dsfr/Accordion";
import { Checkbox } from "@codegouvfr/react-dsfr/Checkbox";
import { Button } from "@codegouvfr/react-dsfr/Button";
import dayjs from "dayjs";
import SelectNextOwner from "./select-next-owner";
import CarcassesIntermediaire from "./carcasses-intermediaire";
import type { SerializeFrom } from "@remix-run/node";
import EntityNotEditable from "~/components/EntityNotEditable";

export default function FEICurrentIntermediaire() {
  const { fei, user } = useLoaderData<typeof clientLoader>();

  const [intermediaireIndex, setIntermediaireIndex] = useState(0);
  const intermediaire = fei.FeiIntermediaires[intermediaireIndex];
  const priseEnChargeFetcher = useFetcher({ key: "prise-en-charge" });

  const carcassesUnsorted = fei.Carcasses;
  const carcassesSorted = useMemo(() => {
    const intermediaireCheckById: Record<string, SerializeFrom<CarcasseIntermediaire>> = {};
    for (const intermediaireCheck of intermediaire.CarcasseIntermediaire) {
      intermediaireCheckById[intermediaireCheck.fei_numero__bracelet__intermediaire_id] = intermediaireCheck;
    }
    const carcassesApproved: Record<string, SerializeFrom<Carcasse>> = {};
    const carcassesRefused: Record<string, SerializeFrom<Carcasse>> = {};
    const carcassesToCheck: Record<string, SerializeFrom<Carcasse>> = {};
    for (const carcasse of carcassesUnsorted) {
      const checkId = `${fei.numero}__${carcasse.numero_bracelet}__${intermediaire.id}`;
      if (intermediaireCheckById[checkId]) {
        if (intermediaireCheckById[checkId].prise_en_charge) {
          carcassesApproved[checkId] = carcasse;
        } else {
          carcassesRefused[checkId] = carcasse;
        }
      } else {
        if (carcasse.intermediaire_carcasse_refus_intermediaire_id) {
          if (carcasse.intermediaire_carcasse_refus_intermediaire_id === intermediaire.id) {
            carcassesRefused[checkId] = carcasse;
          }
        } else {
          carcassesToCheck[checkId] = carcasse;
        }
      }
    }
    return {
      carcassesApproved: Object.values(carcassesApproved),
      carcassesRefused: Object.values(carcassesRefused),
      carcassesToCheck: Object.values(carcassesToCheck),
    };
  }, [carcassesUnsorted, intermediaire, fei]);

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

  const jobIsDone = carcassesSorted.carcassesToCheck.length === 0;

  const needSelectNextUser = useMemo(() => {
    if (fei.fei_current_owner_user_id !== user.id) {
      return false;
    }
    if (!intermediaire.check_finished_at) {
      return false;
    }
    const latestIntermediaire = fei.FeiIntermediaires[0];
    if (latestIntermediaire.id !== intermediaire.id) {
      return false;
    }
    return true;
  }, [fei, user, intermediaire]);

  const prevCarcassesToCheckCount = useRef(carcassesSorted.carcassesToCheck.length);
  const [carcassesAValiderExpanded, setCarcassesAValiderExpanded] = useState(
    carcassesSorted.carcassesToCheck.length > 0,
  );
  const [carcassesAccepteesExpanded, setCarcassesAccepteesExpanded] = useState(false);
  const [carcassesRefuseesExpanded, setCarcassesRefuseesExpanded] = useState(false);

  useEffect(() => {
    if (prevCarcassesToCheckCount.current > 0 && carcassesSorted.carcassesToCheck.length === 0) {
      setCarcassesAValiderExpanded(false);
      setCarcassesAccepteesExpanded(false);
      setCarcassesRefuseesExpanded(false);
    }
    prevCarcassesToCheckCount.current = carcassesSorted.carcassesToCheck.length;
  }, [carcassesSorted.carcassesToCheck.length]);

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
          Voir les intermédiaires
        </button>
        <div className="fr-collapse" id="breadcrumb-:r55:" data-fr-js-collapse="true">
          <ol className="fr-breadcrumb__list">
            <li>
              <span className="fr-breadcrumb__link !bg-none !no-underline">Premier Détenteur</span>
            </li>
            {fei.FeiIntermediaires.map((_intermediaire, index) => {
              return (
                <li key={_intermediaire.id}>
                  <button
                    onClick={() => setIntermediaireIndex(index)}
                    className="fr-breadcrumb__link"
                    aria-current={_intermediaire.id === intermediaire.id ? "step" : false}
                  >
                    {_intermediaire.FeiIntermediaireEntity.raison_sociale}
                  </button>
                </li>
              );
            }).reverse()}
          </ol>
        </div>
      </nav>
      <Accordion titleAs="h3" label={`Identité de l'intermédaire ${canEdit ? "🔒" : ""}`}>
        <EntityNotEditable user={intermediaire.FeiIntermediaireUser} entity={intermediaire.FeiIntermediaireEntity} />
      </Accordion>
      {carcassesSorted.carcassesToCheck.length > 0 && (
        <Accordion
          titleAs="h3"
          label={`Carcasses à vérifier (${carcassesSorted.carcassesToCheck.length})`}
          expanded={carcassesAValiderExpanded}
          onExpandedChange={setCarcassesAValiderExpanded}
        >
          <CarcassesIntermediaire canEdit={canEdit} carcasses={carcassesSorted.carcassesToCheck} />
        </Accordion>
      )}
      <Accordion
        titleAs="h3"
        label={`Carcasses acceptées (${carcassesSorted.carcassesApproved.length})`}
        expanded={carcassesAccepteesExpanded}
        onExpandedChange={setCarcassesAccepteesExpanded}
      >
        {carcassesSorted.carcassesApproved.length === 0 ? (
          <p>Pas de carcasse acceptée</p>
        ) : (
          <CarcassesIntermediaire canEdit={canEdit} carcasses={carcassesSorted.carcassesApproved} />
        )}
      </Accordion>
      <Accordion
        titleAs="h3"
        label={`Carcasses rejetées (${carcassesSorted.carcassesRefused.length})`}
        expanded={carcassesRefuseesExpanded}
        onExpandedChange={setCarcassesRefuseesExpanded}
      >
        {carcassesSorted.carcassesRefused.length === 0 ? (
          <p>Pas de carcasse refusée</p>
        ) : (
          <CarcassesIntermediaire canEdit={canEdit} carcasses={carcassesSorted.carcassesRefused} />
        )}
      </Accordion>
      <Accordion titleAs="h3" label="Prise en charge des carcasses acceptées" defaultExpanded key={intermediaire.id}>
        <priseEnChargeFetcher.Form method="POST" id="check_finished_at">
          <input type="hidden" name="route" value="/api/action/carcasse-suivi" />
          <input type="hidden" name={Prisma.FeiScalarFieldEnum.numero} value={fei.numero} />
          <input
            form="check_finished_at"
            type="hidden"
            name={Prisma.CarcasseIntermediaireScalarFieldEnum.fei_numero}
            value={fei.numero}
          />
          <input
            type="hidden"
            form="check_finished_at"
            name={Prisma.CarcasseIntermediaireScalarFieldEnum.fei_intermediaire_id}
            value={intermediaire.id}
          />
          <div
            className={["fr-fieldset__element", intermediaire.check_finished_at ? "pointer-events-none" : ""].join(" ")}
          >
            <Checkbox
              options={[
                {
                  label: `${intermediaire.check_finished_at ? "J'ai pris" : "Je prends"} en charge les carcasses que j'ai acceptées.`,
                  nativeInputProps: {
                    required: true,
                    name: Prisma.CarcasseIntermediaireScalarFieldEnum.check_finished_at,
                    value: "true",
                    disabled: !jobIsDone,
                    readOnly: !!intermediaire.check_finished_at,
                    defaultChecked: intermediaire.check_finished_at ? true : false,
                  },
                },
              ]}
            />
            {!intermediaire.check_finished_at && (
              <Button type="submit" disabled={!jobIsDone}>
                Enregistrer
              </Button>
            )}
          </div>
          {!!intermediaire.check_finished_at && (
            <div className="fr-fieldset__element">
              <InputNotEditable
                label="Date de prise en charge"
                nativeInputProps={{
                  id: Prisma.CarcasseIntermediaireScalarFieldEnum.check_finished_at,
                  name: Prisma.CarcasseIntermediaireScalarFieldEnum.check_finished_at,
                  type: "datetime-local",
                  suppressHydrationWarning: true,
                  autoComplete: "off",
                  defaultValue: dayjs(intermediaire.check_finished_at).format("YYYY-MM-DDTHH:mm"),
                }}
              />
            </div>
          )}
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
