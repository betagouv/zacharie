import { useMemo } from 'react';
import { UserRoles } from '@prisma/client';
import ConfirmModal from '@app/components/ConfirmModal';
import { useNavigate, useParams } from 'react-router';
import useUser from '@app/zustand/user';
import useZustandStore from '@app/zustand/store';
import dayjs from 'dayjs';
import { createHistoryInput } from '@app/utils/create-history-entry';

export default function SviSaisieToutesCarcasses() {
  const params = useParams();
  const user = useUser((state) => state.user)!;
  const updateFei = useZustandStore((state) => state.updateFei);
  const addLog = useZustandStore((state) => state.addLog);
  const feis = useZustandStore((state) => state.feis);
  const fei = feis[params.fei_numero!];

  const navigate = useNavigate();

  const canSaisirToutesCarcasses = useMemo(() => {
    if (!fei.svi_assigned_at) {
      return false;
    }
    if (!user.roles.includes(UserRoles.SVI)) {
      return false;
    }
    return true;
  }, [user.roles, fei.fei_current_owner_user_id, user.id]);

  if (!canSaisirToutesCarcasses) {
    return null;
  }

  return (
    <ConfirmModal
      title="Voulez-vous vraiment saisir toutes les carcasses ?"
      buttonText="Saisir toutes les carcasses"
      textToConfirm="SAISIR TOUTES LES CARCASSES"
      onConfirm={() => {
        // const partialCarcasse: Partial<Carcasse> = {
        //   svi_ipm2_date: dayjs.utc().startOf('day').toDate(),
        //   svi_ipm2_presentee_inspection: true,
        //   svi_ipm2_protocole: 'IPM2',
        //   svi_ipm2_pieces: 'IPM2',
        //   svi_ipm2_lesions_ou_motifs: 'IPM2',
        //   svi_ipm2_nombre_animaux: 'IPM2',
        //   svi_ipm2_commentaire: sviIpm2Commentaire,
        //   svi_ipm2_decision: sviIpm2Decision,
        //   svi_ipm2_traitement_assainissant: sviIpm2TraitementAssainissant,
        //   svi_ipm2_traitement_assainissant_cuisson_temps: sviIpm2TraitementAssainissantCuissonTemps,
        //   svi_ipm2_traitement_assainissant_cuisson_temp: sviIpm2TraitementAssainissantCuissonTemp,
        //   svi_ipm2_traitement_assainissant_congelation_temps: sviIpm2TraitementAssainissantCongelationTemps,
        //   svi_ipm2_traitement_assainissant_congelation_temp: sviIpm2TraitementAssainissantCongelationTemp,
        //   svi_ipm2_traitement_assainissant_type: sviIpm2TraitementAssainissantType,
        //   svi_ipm2_traitement_assainissant_paramètres: sviIpm2TraitementAssainissantParamètres,
        //   svi_ipm2_traitement_assainissant_etablissement: sviIpm2TraitementAssainissantEtablissement,
        //   svi_ipm2_traitement_assainissant_poids: sviIpm2TraitementAssainissantPoids,
        //   svi_ipm2_poids_saisie: sviIpm2PoidsSaisie,
        //   svi_ipm2_user_id: carcasse.svi_ipm2_user_id ?? user.id,
        //   svi_ipm2_user_name_cache: carcasse.svi_ipm2_user_name_cache ?? `${user.prenom} ${user.nom_de_famille}`,
        //   svi_ipm2_signed_at: dayjs.utc().toDate(),
        //   svi_assigned_to_fei_at: carcasse.svi_assigned_to_fei_at ?? dayjs.utc().toDate(),
        // };
        // updateCarcasse(carcasse.zacharie_carcasse_id, partialCarcasse);
        // if (fei.fei_current_owner_role !== UserRoles.SVI) {
        //   const nextFei: Partial<Fei> = {
        //     fei_current_owner_role: UserRoles.SVI,
        //     fei_current_owner_entity_id: fei.fei_next_owner_entity_id,
        //     fei_current_owner_entity_name_cache: fei.fei_next_owner_entity_name_cache,
        //     fei_current_owner_user_id: user.id,
        //     fei_current_owner_user_name_cache:
        //       fei.fei_next_owner_user_name_cache || `${user.prenom} ${user.nom_de_famille}`,
        //     fei_next_owner_role: null,
        //     fei_next_owner_user_id: null,
        //     fei_next_owner_user_name_cache: null,
        //     fei_next_owner_entity_id: null,
        //     fei_next_owner_entity_name_cache: null,
        //     fei_prev_owner_role: fei.fei_current_owner_role || null,
        //     fei_prev_owner_user_id: fei.fei_current_owner_user_id || null,
        //     fei_prev_owner_entity_id: fei.fei_current_owner_entity_id || null,
        //     svi_user_id: user.id,
        //   };
        //   updateFei(fei.numero, nextFei);
        // }
        // addLog({
        //   user_id: user.id,
        //   user_role: UserRoles.SVI,
        //   fei_numero: fei.numero,
        //   action: 'svi-ipm2-edit',
        //   history: createHistoryInput(carcasse, partialCarcasse),
        //   entity_id: null,
        //   zacharie_carcasse_id: carcasse.zacharie_carcasse_id,
        //   fei_intermediaire_id: null,
        //   carcasse_intermediaire_id: null,
        // });
        setTimeout(() => {
          navigate(-1);
        }, 1000);
      }}
    />
  );
}
