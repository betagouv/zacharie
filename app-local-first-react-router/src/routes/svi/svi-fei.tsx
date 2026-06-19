import { useMemo, useState } from 'react';
import { useParams } from 'react-router';
import dayjs from 'dayjs';
import useZustandStore from '@app/zustand/store';
import { syncData } from '@app/utils/sync-data';
import Chargement from '@app/components/Chargement';
import NotFound from '@app/components/NotFound';
import FeiSousTraite from './current-owner-sous-traite';
import { Button } from '@codegouvfr/react-dsfr/Button';
import SviHeaderFiche from './svi-header-fiche';
import { Carcasse, CarcasseStatus, EntityRelationType, FeiOwnerRole, Prisma, UserRoles } from '@prisma/client';
import InputNotEditable from '@app/components/InputNotEditable';
import { Checkbox } from '@codegouvfr/react-dsfr/Checkbox';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import useUser from '@app/zustand/user';
import CardCarcasseSvi from '@app/components/CardCarcasseSvi';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { createHistoryInput } from '@app/utils/create-history-entry';
import { sortCarcassesApproved } from '@app/utils/sort';
import FEIDonneesDeChasse from '@app/components/DonneesDeChasse';
import Section from '@app/components/Section';
import CardCarcasse from '@app/components/CardCarcasse';
import { PendingModificationBanner } from '@app/components/CarcasseModificationRequest';
import { loadData, useLoaderEffect } from '@app/utils/load-data';
import { useGetTransmissionFromURLParams } from '@app/utils/get-transmissions-sorted';
import { CarcasseTransmission } from '@app/types/carcasse';

export default function SviFeiLoader() {
  const params = useParams();
  const feis = useZustandStore((state) => state.feis);
  const fei = feis[params.fei_numero!];
  const [hasTriedLoading, setHasTriedLoading] = useState(false);

  useLoaderEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    loadData('svi-fei').then(() => setHasTriedLoading(true));
  }, []);

  if (!fei) {
    return hasTriedLoading ? <NotFound /> : <Chargement />;
  }
  return <SviFei key={fei.numero} />;
}

function SviFei() {
  const params = useParams();
  const feis = useZustandStore((state) => state.feis);
  const fei = feis[params.fei_numero!];

  return (
    <>
      <title>{`${params.fei_numero} | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire`}</title>
      {fei.deleted_at && (
        <div className="bg-error-main-525 mb-2 py-2 text-center text-white">
          <p>Fiche supprimée</p>
        </div>
      )}
      <div className="fr-container fr-container--fluid fr-my-md-14v">
        <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
          <div className="fr-col-12 fr-col-md-10 bg-alt-blue-france [&_.fr-tabs\\_\\_list]:bg-alt-blue-france m-4 md:m-0 md:p-0">
            <SviHeaderFiche />
            <FeiSousTraite />
            <FEI_SVI />
            <div className="m-8 flex flex-col justify-start gap-4">
              <Button
                priority="secondary"
                linkProps={{
                  to: `/app/svi/`,
                }}
              >
                Voir toutes mes fiches
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function FEI_SVI() {
  const user = useUser((state) => state.user)!;
  const entities = useZustandStore((state) => state.entities);
  const updateCarcasse = useZustandStore((state) => state.updateCarcasse);
  const updateCarcassesTransmission = useZustandStore((state) => state.updateCarcassesTransmission);
  const addLog = useZustandStore((state) => state.addLog);
  const transmissionMetadata = useGetTransmissionFromURLParams();
  const fei_numero = transmissionMetadata.fei.numero;
  const transmission = transmissionMetadata.content;
  const myCarcasses = transmissionMetadata.carcasses;
  const carcasseIds = myCarcasses.map((c) => c.zacharie_carcasse_id);
  const allCarcassesForFei = useMemo(() => [...myCarcasses].sort(sortCarcassesApproved), [myCarcasses]);

  const carcassesDejaRefusees = useMemo(
    () => allCarcassesForFei.filter((c) => !!c.intermediaire_carcasse_refus_intermediaire_id),
    [allCarcassesForFei]
  );

  const carcassesAAfficher = useMemo(
    () => allCarcassesForFei.filter((c) => !c.intermediaire_carcasse_refus_intermediaire_id),
    [allCarcassesForFei]
  );

  // Clôture par carcasse : la fiche est close "pour ce SVI" quand toutes ses carcasses le sont.
  const mySviClosed = useMemo(
    () => carcassesAAfficher.length > 0 && carcassesAAfficher.every((c) => !!c.svi_closed_at),
    [carcassesAAfficher]
  );
  const mySviClosedAt = useMemo(
    () => carcassesAAfficher.find((c) => c.svi_closed_at)?.svi_closed_at ?? null,
    [carcassesAAfficher]
  );
  const myAutomaticClosed = useMemo(
    () => carcassesAAfficher.length > 0 && carcassesAAfficher.every((c) => !!c.svi_automatic_closed_at),
    [carcassesAAfficher]
  );
  const myAutomaticClosedAt = useMemo(
    () => carcassesAAfficher.find((c) => c.svi_automatic_closed_at)?.svi_automatic_closed_at ?? null,
    [carcassesAAfficher]
  );

  const [showRefusedCarcasses, setShowRefusedCarcasses] = useState(false);

  const isSviWorkingFor = useMemo(() => {
    if (transmission.svi_entity_id) {
      if (user.roles.includes(UserRoles.SVI)) {
        const svi = entities[transmission.svi_entity_id];
        if (svi?.relation === EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY) {
          return true;
        }
      }
    }
    return false;
  }, [transmission, user, entities]);

  const canEdit = useMemo(() => {
    if (myAutomaticClosed) {
      return false;
    }
    if (isSviWorkingFor) {
      return true;
    }
    if (transmission.current_owner_user_id !== user.id) {
      return false;
    }
    if (transmission.current_owner_role !== FeiOwnerRole.SVI) {
      return false;
    }
    return true;
  }, [transmission, user, isSviWorkingFor, myAutomaticClosed]);

  const DateFinInput = canEdit ? Input : InputNotEditable;

  // au moment où le SVI clôture la fiche, il en prend la responsabilité :
  // l'ownership passe au SVI sur toutes les carcasses du groupe de transmission.
  function closeFiche(sviClosedAt: Date, action: string) {
    for (const carcasse of carcassesAAfficher) {
      const carcasseUpdate: Partial<Carcasse> = {
        svi_closed_at: sviClosedAt,
        svi_closed_by_user_id: user.id,
      };
      if (!carcasse.svi_carcasse_status || carcasse.svi_carcasse_status === CarcasseStatus.SANS_DECISION) {
        carcasseUpdate.svi_carcasse_status = CarcasseStatus.ACCEPTE;
        carcasseUpdate.svi_carcasse_status_set_at = sviClosedAt;
      }
      updateCarcasse(carcasse.zacharie_carcasse_id, carcasseUpdate, false);
    }
    const nextTransmission: CarcasseTransmission = {};
    if (transmission.current_owner_role !== FeiOwnerRole.SVI) {
      nextTransmission.current_owner_role = FeiOwnerRole.SVI;
      nextTransmission.current_owner_entity_id = transmission.next_owner_entity_id ?? null;
      nextTransmission.current_owner_entity_name_cache = transmission.next_owner_entity_name_cache ?? null;
      nextTransmission.current_owner_user_id = user.id;
      nextTransmission.current_owner_user_name_cache =
        transmission.next_owner_user_name_cache || `${user.prenom} ${user.nom_de_famille}`;
      nextTransmission.next_owner_role = null;
      nextTransmission.next_owner_user_id = null;
      nextTransmission.next_owner_user_name_cache = null;
      nextTransmission.next_owner_entity_id = null;
      nextTransmission.next_owner_entity_name_cache = null;
      nextTransmission.prev_owner_role = transmission.current_owner_role || null;
      nextTransmission.prev_owner_user_id = transmission.current_owner_user_id || null;
      nextTransmission.prev_owner_entity_id = transmission.current_owner_entity_id || null;
      nextTransmission.svi_user_id = user.id;
      updateCarcassesTransmission(carcasseIds, nextTransmission);
    }
    addLog({
      user_id: user.id,
      action,
      fei_numero: fei_numero,
      history: createHistoryInput(transmission, nextTransmission),
      user_role: UserRoles.SVI,
      entity_id: transmission.svi_entity_id,
      zacharie_carcasse_id: null,
      carcasse_intermediaire_id: null,
      intermediaire_id: null,
    });
    syncData(action);
  }

  return (
    <>
      <Section
        open={false}
        title="Données de chasse"
      >
        <FEIDonneesDeChasse />
      </Section>
      <Section title={`Carcasses à inspecter (${carcassesAAfficher.length})`}>
        <div className="flex flex-col gap-4">
          {carcassesAAfficher.map((carcasse) => {
            return (
              <div
                className="flex flex-col"
                key={carcasse.numero_bracelet}
              >
                <CardCarcasseSvi
                  canClick
                  carcasse={carcasse}
                />
                <PendingModificationBanner carcasse={carcasse} />
              </div>
            );
          })}
        </div>
        {carcassesDejaRefusees.length > 0 && (
          <div className="my-8 flex justify-center">
            <Button
              onClick={() => {
                setShowRefusedCarcasses(!showRefusedCarcasses);
              }}
              priority="secondary"
            >
              {showRefusedCarcasses ? 'Masquer' : 'Afficher'} les carcasses déjà refusées (
              {carcassesDejaRefusees.length})
            </Button>
          </div>
        )}
        {showRefusedCarcasses && (
          <div className="flex flex-col gap-4">
            {carcassesDejaRefusees.map((carcasse) => {
              return (
                <CardCarcasse
                  carcasse={carcasse}
                  key={carcasse.numero_bracelet}
                />
              );
            })}
          </div>
        )}
      </Section>
      <Section title="Validation de la fiche">
        <form
          method="POST"
          id="svi_check_finished_at"
          onSubmit={(e) => {
            e.preventDefault();
            closeFiche(dayjs().toDate(), 'svi-check-finished-at');
          }}
        >
          {!myAutomaticClosed && (
            <>
              <Checkbox
                className={!canEdit ? 'checkbox-black' : ''}
                options={[
                  {
                    label: 'Inspection de toutes les carcasses terminée. Clôturer la fiche.',
                    nativeInputProps: {
                      required: true,
                      name: 'svi_finito',
                      value: 'true',
                      readOnly: mySviClosed || myAutomaticClosed,
                      defaultChecked: mySviClosed ? true : false,
                    },
                  },
                ]}
              />
              <Button
                type="submit"
                className="my-4"
                disabled={!canEdit}
              >
                Enregistrer
              </Button>
            </>
          )}

          {mySviClosed && (
            <DateFinInput
              label="Date de fin d'inspection"
              nativeInputProps={{
                id: Prisma.CarcasseScalarFieldEnum.svi_closed_at,
                name: Prisma.CarcasseScalarFieldEnum.svi_closed_at,
                type: 'datetime-local',
                autoComplete: 'off',
                onBlur: (e) => {
                  closeFiche(dayjs(e.target.value).toDate(), 'svi-check-finished-at-update');
                },
                suppressHydrationWarning: true,
                defaultValue: dayjs(mySviClosedAt).format('YYYY-MM-DDTHH:mm'),
              }}
            />
          )}
          {myAutomaticClosed && (
            <DateFinInput
              label="Date de clôture automatique"
              hintText="La fiche a été clôturée automatiquement par le système 10 jours après la date d'assignation au SVI"
              nativeInputProps={{
                id: Prisma.CarcasseScalarFieldEnum.svi_automatic_closed_at,
                name: Prisma.CarcasseScalarFieldEnum.svi_automatic_closed_at,
                type: 'datetime-local',
                autoComplete: 'off',
                suppressHydrationWarning: true,
                defaultValue: dayjs(myAutomaticClosedAt).format('YYYY-MM-DDTHH:mm'),
              }}
            />
          )}
        </form>
      </Section>
      {(mySviClosed || myAutomaticClosed || transmission.intermediaire_closed_at) && (
        <div className="bg-white px-4 pb-4 md:px-8 md:pb-8">
          <Alert
            severity="success"
            className="md:mx-4"
            description="L'inspection des carcasses est terminée, cette fiche est clôturée. Merci !"
            title="Fiche clôturée"
          />
        </div>
      )}
    </>
  );
}
