import { useMemo, useState } from 'react';
import { useParams } from 'react-router';
import dayjs from 'dayjs';
import { Prisma, Carcasse, UserRoles } from '@prisma/client';
import InputNotEditable from '@app/components/InputNotEditable';
import { Accordion } from '@codegouvfr/react-dsfr/Accordion';
import { Checkbox } from '@codegouvfr/react-dsfr/Checkbox';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import EntityNotEditable from '@app/components/EntityNotEditable';
import useUser from '@app/zustand/user';
import useZustandStore from '@app/zustand/store';
import CarcasseSVI from './svi-carcasse';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { createHistoryInput } from '@app/utils/create-history-entry';

export default function FEI_SVI() {
  const params = useParams();
  const user = useUser((state) => state.user)!;
  const state = useZustandStore((state) => state);
  const fei = state.feis[params.fei_numero!];
  const updateFei = state.updateFei;
  const addLog = state.addLog;
  const sviUser = fei.svi_user_id ? state.users[fei.svi_user_id] : null;
  const svi = fei.svi_entity_id ? state.entities[fei.svi_entity_id] : null;
  const carcassesUnsorted = (state.carcassesIdsByFei[params.fei_numero!] || [])
    .map((cId) => state.carcasses[cId])
    .filter((carcasse) => !carcasse.deleted_at && !carcasse.intermediaire_carcasse_refus_intermediaire_id);

  const carcassesSorted = useMemo(() => {
    const carcassesValidated: Record<Carcasse['zacharie_carcasse_id'], Carcasse> = {};
    const carcassesSaisies: Record<Carcasse['zacharie_carcasse_id'], Carcasse> = {};
    // const carcassesToCheck: Record<Carcasse['zacharie_carcasse_id'], Carcasse> = {};
    for (const carcasse of carcassesUnsorted) {
      if (carcasse.svi_carcasse_saisie_motif?.filter(Boolean)?.length) {
        carcassesSaisies[carcasse.zacharie_carcasse_id] = carcasse;
        continue;
      }
      // if (carcasse.svi_carcasse_signed_at) {
      carcassesValidated[carcasse.zacharie_carcasse_id] = carcasse;
      // continue;
      // }
      // carcassesToCheck[carcasse.zacharie_carcasse_id] = carcasse;
    }
    return {
      carcassesValidated: Object.values(carcassesValidated),
      carcassesSaisies: Object.values(carcassesSaisies),
      // carcassesToCheck: Object.values(carcassesToCheck),
    };
  }, [carcassesUnsorted]);

  const isSviWorkingFor = useMemo(() => {
    if (fei.fei_current_owner_role === UserRoles.SVI && !!fei.svi_entity_id) {
      if (user.roles.includes(UserRoles.SVI)) {
        const svi = state.entities[fei.svi_entity_id];
        console.log({ svi });
        if (svi?.relation === 'WORKING_FOR') {
          return true;
        }
      }
    }
    return false;
  }, [fei, user, state]);

  const canEdit = useMemo(() => {
    if (isSviWorkingFor) {
      return true;
    }
    if (fei.fei_current_owner_user_id !== user.id) {
      return false;
    }
    // if (fei.svi_signed_at) {
    //   return false;
    // }
    if (fei.automatic_closed_at) {
      return false;
    }
    if (fei.fei_current_owner_role !== UserRoles.SVI) {
      return false;
    }
    return true;
  }, [fei, user, isSviWorkingFor]);

  // const jobIsDone = carcassesSorted.carcassesToCheck.length === 0;
  const DateFinInput = canEdit ? Input : InputNotEditable;

  const [carcassesAValiderExpanded, setCarcassesAValiderExpanded] = useState(true);
  const [carcassesAccepteesExpanded, setCarcassesAccepteesExpanded] = useState(true);
  const [carcassesRefuseesExpanded, setCarcassesRefuseesExpanded] = useState(true);

  return (
    <>
      <Accordion titleAs="h3" label={`Identité du SVI ${canEdit ? '🔒' : ''}`}>
        <EntityNotEditable user={sviUser!} entity={svi!} />
      </Accordion>
      {canEdit ? (
        <Accordion
          titleAs="h3"
          // label={`Carcasses à vérifier (${carcassesSorted.carcassesToCheck.length})`}
          label={`Carcasses à vérifier (${carcassesUnsorted.length})`}
          expanded={carcassesAValiderExpanded}
          onExpandedChange={setCarcassesAValiderExpanded}
        >
          <p className="text-sm text-gray-600">
            Veuillez cliquer sur une carcasse pour la saisir ou l'annoter
          </p>
          {carcassesUnsorted.map((carcasse) => {
            return <CarcasseSVI canEdit={canEdit} key={carcasse.numero_bracelet} carcasse={carcasse} />;
          })}
        </Accordion>
      ) : (
        <>
          <Accordion
            titleAs="h3"
            label={`Carcasses validées (${carcassesSorted.carcassesValidated.length})`}
            expanded={carcassesAccepteesExpanded}
            onExpandedChange={setCarcassesAccepteesExpanded}
          >
            {carcassesSorted.carcassesValidated.length === 0 ? (
              <p>Pas de carcasse acceptée</p>
            ) : (
              carcassesSorted.carcassesValidated.map((carcasse) => {
                return <CarcasseSVI canEdit={canEdit} key={carcasse.numero_bracelet} carcasse={carcasse} />;
              })
            )}
          </Accordion>
          <Accordion
            titleAs="h3"
            label={`Carcasses saisies (${carcassesSorted.carcassesSaisies.length})`}
            expanded={carcassesRefuseesExpanded}
            onExpandedChange={setCarcassesRefuseesExpanded}
          >
            {carcassesSorted.carcassesSaisies.length === 0 ? (
              <p>Pas de carcasse refusée</p>
            ) : (
              carcassesSorted.carcassesSaisies.map((carcasse) => {
                return <CarcasseSVI canEdit={canEdit} key={carcasse.numero_bracelet} carcasse={carcasse} />;
              })
            )}
          </Accordion>
        </>
      )}
      <Accordion titleAs="h3" label="Validation de la fiche" defaultExpanded>
        <form
          method="POST"
          id="svi_check_finished_at"
          onSubmit={(e) => {
            e.preventDefault();
            const nextFei = {
              svi_signed_at: dayjs().toDate(),
            };
            updateFei(fei.numero, nextFei);
            addLog({
              user_id: user.id,
              action: 'svi-check-finished-at',
              fei_numero: fei.numero,
              history: createHistoryInput(fei, nextFei),
              user_role: UserRoles.SVI,
              entity_id: fei.svi_entity_id,
              zacharie_carcasse_id: null,
              carcasse_intermediaire_id: null,
              fei_intermediaire_id: null,
            });
          }}
        >
          <div className={['fr-fieldset__element', !canEdit ? 'pointer-events-none' : ''].join(' ')}>
            <Checkbox
              options={[
                {
                  label: "J'ai fini l'inspection de toutes les carcasses et je clôture la fiche.",
                  nativeInputProps: {
                    required: true,
                    name: 'svi_finito',
                    value: 'true',
                    readOnly: !!fei.svi_signed_at || !!fei.automatic_closed_at,
                    defaultChecked: fei.svi_signed_at ? true : false,
                  },
                },
              ]}
            />
            <Button type="submit" disabled={!canEdit}>
              Enregistrer
            </Button>
          </div>
          {!!fei.svi_signed_at && (
            <div className="fr-fieldset__element">
              <DateFinInput
                label="Date de fin d'inspection"
                nativeInputProps={{
                  id: Prisma.FeiScalarFieldEnum.svi_signed_at,
                  name: Prisma.FeiScalarFieldEnum.svi_signed_at,
                  type: 'datetime-local',
                  autoComplete: 'off',
                  onBlur: (e) => {
                    const nextFei = {
                      svi_signed_at: dayjs(e.target.value).toDate(),
                    };
                    updateFei(fei.numero, nextFei);
                    addLog({
                      user_id: user.id,
                      action: 'svi-check-finished-at-update',
                      fei_numero: fei.numero,
                      history: createHistoryInput(fei, nextFei),
                      user_role: UserRoles.SVI,
                      entity_id: fei.svi_entity_id,
                      zacharie_carcasse_id: null,
                      carcasse_intermediaire_id: null,
                      fei_intermediaire_id: null,
                    });
                  },
                  suppressHydrationWarning: true,
                  defaultValue: dayjs(fei.svi_signed_at).format('YYYY-MM-DDTHH:mm'),
                }}
              />
            </div>
          )}
          {!!fei.automatic_closed_at && (
            <div className="fr-fieldset__element">
              <DateFinInput
                label="Date de clôture automatique"
                hintText="La fiche a été clôturée automatiquement par le système 10 jours après la date d'assignation au SVI"
                nativeInputProps={{
                  id: Prisma.FeiScalarFieldEnum.automatic_closed_at,
                  name: Prisma.FeiScalarFieldEnum.automatic_closed_at,
                  type: 'datetime-local',
                  autoComplete: 'off',
                  suppressHydrationWarning: true,
                  defaultValue: dayjs(fei.automatic_closed_at).format('YYYY-MM-DDTHH:mm'),
                }}
              />
            </div>
          )}
        </form>
      </Accordion>
      {(fei.svi_signed_at || fei.automatic_closed_at) && (
        <Alert
          severity="success"
          description="L'inspection des carcasses est terminée, cette fiche est clôturée. Merci !"
          title="Fiche clôturée"
        />
      )}
    </>
  );
}
