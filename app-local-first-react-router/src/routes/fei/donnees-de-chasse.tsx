import { useMemo } from 'react';
import { useParams } from 'react-router';
import { Carcasse, CarcasseType } from '@prisma/client';
import dayjs from 'dayjs';
import useZustandStore from '@app/zustand/store';
import ItemNotEditable from '@app/components/ItemNotEditable';
import { getUserRoleLabel } from '@app/utils/get-user-roles-label';

export default function FEIDonneesDeChasse({
  carcasseId,
}: {
  carcasseId?: Carcasse['zacharie_carcasse_id'];
}) {
  const params = useParams();
  const feis = useZustandStore((state) => state.feis);
  const carcassesState = useZustandStore((state) => state.carcasses);
  const carcassesIdsByFei = useZustandStore((state) => state.carcassesIdsByFei);
  const users = useZustandStore((state) => state.users);
  const entities = useZustandStore((state) => state.entities);
  const fei = feis[params.fei_numero!];
  const getFeiIntermediairesForFeiNumero = useZustandStore((state) => state.getFeiIntermediairesForFeiNumero);
  const intermediaires = getFeiIntermediairesForFeiNumero(fei.numero);
  const latestIntermediaire = intermediaires[0];
  // console.log('fei', fei);
  const carcasses = (carcasseId ? [carcasseId] : carcassesIdsByFei[params.fei_numero!] || [])
    .map((cId) => carcassesState[cId])
    .filter((c) => !c.deleted_at);
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
      const intermediaireLines = [];
      const entity = entities[intermediaire.intermediaire_entity_id!];
      intermediaireLines.push(getUserRoleLabel(intermediaire.intermediaire_role!));
      intermediaireLines.push(entity.siret);
      intermediaireLines.push(`${entity.code_postal} ${entity.ville}`);
      if (intermediaire.prise_en_charge_at) {
        intermediaireLines.push(
          `Prise en charge\u00A0: ${dayjs(intermediaire.prise_en_charge_at).format('dddd D MMMM à HH:mm')}`,
        );
      }
      lines.push({ label: entity.nom_d_usage, value: intermediaireLines });
    }
    return lines;
  }, [intermediaires, entities]);

  const etgDate = latestIntermediaire
    ? dayjs(latestIntermediaire.prise_en_charge_at).format('dddd D MMMM YYYY à HH:mm')
    : null;
  const sviAssignedToFeiAt = fei.svi_assigned_at
    ? dayjs(fei.svi_assigned_at).format('dddd D MMMM YYYY à HH:mm')
    : null;

  const milestones = useMemo(() => {
    const _milestones = [
      `Commune de mise à mort\u00A0: ${fei?.commune_mise_a_mort ?? ''}`,
      `Date de mise à mort\u00A0: ${dayjs(fei.date_mise_a_mort).format('dddd D MMMM YYYY')}`,
      `Heure de mise à mort de la première carcasse de la fiche\u00A0: ${fei.heure_mise_a_mort_premiere_carcasse!}`,
    ];
    if (onlyPetitGibier) {
      _milestones.push(
        `Heure d'éviscération de la dernière carcasse de la fiche\u00A0: ${fei.heure_evisceration_derniere_carcasse!}`,
      );
    }
    if (etgDate) _milestones.push(`Date et heure de prise en charge par l'ETG\u00A0: ${etgDate}`);
    if (sviAssignedToFeiAt)
      _milestones.push(`Date et heure d'assignation au SVI\u00A0: ${sviAssignedToFeiAt}`);
    return _milestones;
  }, [
    fei.commune_mise_a_mort,
    etgDate,
    onlyPetitGibier,
    fei.date_mise_a_mort,
    fei.heure_mise_a_mort_premiere_carcasse,
    fei.heure_evisceration_derniere_carcasse,
    sviAssignedToFeiAt,
  ]);

  return (
    <>
      <ItemNotEditable
        label={carcasses.length > 1 ? 'Espèces' : 'Espèce'}
        value={[...new Set(carcasses.map((c) => c.espece))].join(', ')}
      />
      <ItemNotEditable label="Informations clés" value={milestones} />
      <p className="mb-2 font-bold">Acteurs</p>
      <div className="flex flex-col px-2">
        <ItemNotEditable label="Examinateur Initial" value={examinateurInitialInput} />
        <ItemNotEditable label="Premier Détenteur" value={premierDetenteurInput} />
        {intermediairesInputs.map((intermediaireInput, index) => {
          return (
            <ItemNotEditable key={index} label={intermediaireInput.label!} value={intermediaireInput.value} />
          );
        })}
      </div>
    </>
  );
}
