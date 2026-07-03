import { useMemo } from 'react';
import { useParams } from 'react-router';
import { Carcasse, CarcasseType, EntityTypes, FeiOwnerRole } from '@prisma/client';
import dayjs from 'dayjs';
import useZustandStore from '@app/zustand/store';
import ItemNotEditable from '@app/components/ItemNotEditable';
import { getIntermediaireRoleLabel } from '@app/utils/get-user-roles-label';
import { CarcassesIntermediaire } from '@app/types/carcasses-intermediaire';
import {
  useGetTransmissionFromCarcasse,
  useGetTransmissionFromURLParams,
} from '@app/utils/get-transmissions-sorted';

export default function FEIDonneesDeChasse({
  carcasseId,
  intermediaires,
}: {
  carcasseId?: Carcasse['zacharie_carcasse_id'];
  intermediaires: Array<CarcassesIntermediaire>;
}) {
  const params = useParams();
  const feis = useZustandStore((state) => state.feis);
  const carcassesState = useZustandStore((state) => state.carcasses);
  const transmission = carcasseId
    ? // eslint-disable-next-line react-hooks/rules-of-hooks
      useGetTransmissionFromCarcasse(carcassesState[carcasseId])
    : // eslint-disable-next-line react-hooks/rules-of-hooks
      useGetTransmissionFromURLParams();
  const users = useZustandStore((state) => state.users);
  const entities = useZustandStore((state) => state.entities);
  const fei = feis[params.fei_numero!];
  const latestIntermediaire = intermediaires[0];
  const carcasses = carcasseId
    ? [carcassesState[carcasseId]].filter(Boolean).filter((c) => !c.deleted_at)
    : transmission?.carcasses;
  const examinateurInitialUser = fei.examinateur_initial_user_id
    ? users[fei.examinateur_initial_user_id!]
    : null;
  const premierDetenteurUser = fei.premier_detenteur_user_id ? users[fei.premier_detenteur_user_id!] : null;
  const premierDetenteurEntity = fei.premier_detenteur_entity_id
    ? entities[fei.premier_detenteur_entity_id!]
    : null;

  const onlyPetitGibier = useMemo(() => {
    for (const carcasse of carcasses) {
      if (carcasse?.type !== CarcasseType.PETIT_GIBIER) {
        return false;
      }
    }
    return true;
  }, [carcasses]);

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
      lines.push(premierDetenteurEntity.nom_d_usage);
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

  const intermediairesInputs = useMemo(() => {
    const lines = [];
    for (let i = intermediaires.length - 1; i >= 0; i--) {
      const intermediaire = intermediaires[i];
      const entity = entities[intermediaire.intermediaire_entity_id!];
      if (
        entity?.type === EntityTypes.ETG &&
        intermediaire.intermediaire_role === FeiOwnerRole.COLLECTEUR_PRO
      ) {
        continue;
      }
      const intermediaireLines = [];
      intermediaireLines.push(getIntermediaireRoleLabel(intermediaire.intermediaire_role!));
      intermediaireLines.push(entity?.siret);
      intermediaireLines.push(`${entity?.code_postal} ${entity?.ville}`);
      if (intermediaire.prise_en_charge_at) {
        intermediaireLines.push(
          `Prise en charge\u00A0: ${dayjs(intermediaire.prise_en_charge_at).format('dddd D MMMM à HH:mm')}`
        );
      }
      lines.push({ label: entity?.nom_d_usage, value: intermediaireLines });
    }
    return lines;
  }, [intermediaires, entities]);

  const sviInput = useMemo(() => {
    const lines: Array<string> = [];
    if (!transmission?.content?.svi_entity_id) return lines;
    const sviEntity = entities[transmission?.content?.svi_entity_id];
    if (sviEntity) {
      if (sviEntity?.nom_d_usage) lines.push(sviEntity?.nom_d_usage);
      lines.push(`${sviEntity?.code_postal} ${sviEntity?.ville}`);
    }
    const sviAssignedAt = transmission.carcasses.reduce<Date | null>((latest, c) => {
      if (!c.svi_assigned_at) return latest;
      const d = dayjs(c.svi_assigned_at).toDate();
      return !latest || d > latest ? d : latest;
    }, null);
    if (sviAssignedAt) {
      lines.push(
        `Date et heure d'assignation au SVI\u00A0: ${dayjs(sviAssignedAt).format('dddd D MMMM YYYY à HH:mm')}`
      );
    }
    const sviClosedAt = transmission.carcasses.reduce<Date | null>((latest, c) => {
      if (!c.svi_closed_at) return latest;
      const d = dayjs(c.svi_closed_at).toDate();
      return !latest || d > latest ? d : latest;
    }, null);
    if (sviClosedAt) {
      lines.push(
        `Date et heure de clôture manuelle du SVI\u00A0: ${dayjs(sviClosedAt).format('dddd D MMMM YYYY à HH:mm')}`
      );
    }
    const sviAutomaticClosedAt = transmission.carcasses.reduce<Date | null>((latest, c) => {
      if (!c.svi_closed_at) return latest;
      const d = dayjs(c.svi_closed_at).toDate();
      return !latest || d > latest ? d : latest;
    }, null);
    if (sviAutomaticClosedAt) {
      lines.push(
        `Date et heure de clôture automatique du SVI\u00A0: ${dayjs(sviAutomaticClosedAt).format('dddd D MMMM YYYY à HH:mm')}`
      );
    }
    return lines;
  }, [transmission?.content?.svi_entity_id, entities, transmission.carcasses]);

  const ccgDate = transmission?.content?.premier_detenteur_depot_ccg_at
    ? dayjs(transmission?.content?.premier_detenteur_depot_ccg_at).format('dddd D MMMM YYYY à HH:mm')
    : null;
  const etgDate = latestIntermediaire?.prise_en_charge_at
    ? dayjs(latestIntermediaire.prise_en_charge_at).format('dddd D MMMM YYYY à HH:mm')
    : null;
  const sviAssignedToFeiAt = transmission?.content?.svi_assigned_at
    ? dayjs(transmission?.content?.svi_assigned_at).format('dddd D MMMM YYYY à HH:mm')
    : null;

  const milestones = useMemo(() => {
    const _milestones = [
      `Commune de mise à mort\u00A0: ${fei?.commune_mise_a_mort ?? ''}`,
      `Date de mise à mort\u00A0: ${dayjs(fei.date_mise_a_mort).format('dddd D MMMM YYYY')}`,
    ];
    if (carcasses[0]?.heure_mise_a_mort_premiere_carcasse_fei) {
      _milestones.push(
        `Heure de mise à mort de la première carcasse de la fiche\u00A0: ${carcasses[0].heure_mise_a_mort_premiere_carcasse_fei}`
      );
    }
    if (!onlyPetitGibier && carcasses[0]?.heure_evisceration_derniere_carcasse_fei) {
      _milestones.push(
        `Heure d'éviscération de la dernière carcasse de la fiche\u00A0: ${carcasses[0].heure_evisceration_derniere_carcasse_fei}`
      );
    }
    if (ccgDate) {
      _milestones.push(
        `Nom du Centre de Collecte (CCG)\u00A0: ${transmission?.content?.premier_detenteur_depot_entity_name_cache}`
      );
      _milestones.push(`Date et heure de dépôt dans le CCG\u00A0: ${ccgDate}`);
    }
    if (etgDate) _milestones.push(`Date et heure de prise en charge par l'ETG\u00A0: ${etgDate}`);
    if (sviAssignedToFeiAt)
      _milestones.push(`Date et heure d'assignation au SVI\u00A0: ${sviAssignedToFeiAt}`);
    return _milestones;
  }, [
    fei.commune_mise_a_mort,
    transmission?.content?.premier_detenteur_depot_entity_name_cache,
    ccgDate,
    etgDate,
    onlyPetitGibier,
    fei.date_mise_a_mort,
    carcasses,
    sviAssignedToFeiAt,
  ]);

  return (
    <>
      <ItemNotEditable
        label="Fiche d'Examen Initial n°"
        value={fei.numero}
      />
      <ItemNotEditable
        label={carcasses.length > 1 ? 'Espèces' : 'Espèce'}
        value={[...new Set(carcasses.map((c) => c.espece))].join(', ')}
      />
      <ItemNotEditable
        label="Informations clés"
        value={milestones}
      />
      <p className="mb-2 font-bold">Acteurs</p>
      <div className="flex flex-col px-2">
        <ItemNotEditable
          label="Examinateur Initial"
          value={examinateurInitialInput}
        />
        <ItemNotEditable
          label="Premier Détenteur"
          value={premierDetenteurInput}
        />
        {intermediairesInputs.map((intermediaireInput, index) => {
          return (
            <ItemNotEditable
              key={index}
              label={intermediaireInput.label!}
              value={intermediaireInput.value}
            />
          );
        })}
        {sviInput.length > 0 && (
          <ItemNotEditable
            label="Service d'Inspection Vétérinaire (SVI)"
            value={sviInput}
          />
        )}
      </div>
    </>
  );
}
