import { Link, useParams } from 'react-router';
import { useMemo } from 'react';
import {
  //  EntityRelationStatus,
  EntityRelationType,
  FeiOwnerRole,
  UserRoles,
} from '@prisma/client';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import useUser from '@app/zustand/user';
import useZustandStore from '@app/zustand/store';
import Section from '@app/components/Section';
import DestinatairePremierDetenteur from './destinataire-premier-detenteur';

export default function FeiPremierDetenteur() {
  const params = useParams();
  const user = useUser((state) => state.user)!;
  const feis = useZustandStore((state) => state.feis);
  const users = useZustandStore((state) => state.users);
  const entities = useZustandStore((state) => state.entities);
  const fei = feis[params.fei_numero!];

  const premierDetenteurUser = fei.premier_detenteur_user_id ? users[fei.premier_detenteur_user_id] : null;
  const premierDetenteurEntity = fei.premier_detenteur_entity_id
    ? entities[fei.premier_detenteur_entity_id]
    : null;

  const premierDetenteurInput = useMemo(() => {
    if (premierDetenteurEntity) {
      return premierDetenteurEntity.nom_d_usage;
    }
    return `${premierDetenteurUser?.prenom} ${premierDetenteurUser?.nom_de_famille}`;
  }, [premierDetenteurEntity, premierDetenteurUser]);

  const canEdit = useMemo(() => {
    if (!user.activated) {
      return false;
    }
    if (fei.automatic_closed_at || fei.svi_closed_at || fei.svi_assigned_at || fei.intermediaire_closed_at) {
      return false;
    }
    if (!fei.examinateur_initial_approbation_mise_sur_le_marche) {
      return false;
    }
    if (fei.fei_current_owner_role !== FeiOwnerRole.PREMIER_DETENTEUR) {
      return false;
    }
    if (!user.roles.includes(UserRoles.CHASSEUR)) {
      return false;
    }
    if (premierDetenteurEntity?.relation === EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY) {
      // if (premierDetenteurEntity?.relationStatus === EntityRelationStatus.ADMIN) {
      //   return true;
      // }
      // if (premierDetenteurEntity?.relationStatus === EntityRelationStatus.MEMBER) {
      //   return true;
      // }
      // return false;
      return true;
    }
    if (fei.fei_current_owner_user_id !== user.id) {
      return false;
    }
    // if (fei.premier_detenteur_depot_ccg_at) {
    //   return false;
    // }
    return true;
  }, [fei, user, premierDetenteurEntity]);

  const waitingForPremierDetenteur = useMemo(() => {
    if (canEdit) {
      return false;
    }
    if (fei.fei_next_owner_role !== FeiOwnerRole.PREMIER_DETENTEUR) {
      return false;
    }
    if (!user.roles.includes(UserRoles.CHASSEUR)) {
      return true;
    }
    if (premierDetenteurEntity?.relation === EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY) {
      // if (premierDetenteurEntity?.relationStatus === EntityRelationStatus.ADMIN) {
      //   return false;
      // }
      // if (premierDetenteurEntity?.relationStatus === EntityRelationStatus.MEMBER) {
      //   return false;
      // }
      // return true;
      return false;
    }
    return true;
  }, [canEdit, fei.fei_next_owner_role, user.roles, premierDetenteurEntity]);

  const showAsDisabled = useMemo(() => {
    if (canEdit) {
      return false;
    }
    if (fei.fei_current_owner_role === FeiOwnerRole.PREMIER_DETENTEUR) {
      if (user.roles.includes(UserRoles.CHASSEUR)) {
        if (premierDetenteurEntity?.relation === EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY) {
          // if (premierDetenteurEntity?.relationStatus === EntityRelationStatus.ADMIN) {
          //   return false;
          // }
          // if (premierDetenteurEntity?.relationStatus === EntityRelationStatus.MEMBER) {
          //   return false;
          // }
          return false;
        }
      }
      return true;
    } else {
      // just cannot edit
      return false;
    }
  }, [fei, user, premierDetenteurEntity, canEdit]);

  if (!fei.premier_detenteur_user_id) {
    return "Il n'y a pas encore de premier détenteur pour cette fiche";
  }

  if (!user.activated) {
    return (
      <Section title={`Action du Premier détenteur | ${premierDetenteurInput}`}>
        <Alert
          severity="warning"
          title="Votre compte est en attente d'activation"
          description={
            <>
              <p className="mb-2">
                Votre compte est actuellement en cours de vérification par l'équipe Zacharie, ou certaines informations
                sont manquantes.
              </p>
              <p className="mb-2">Une fois activé, vous pourrez transmettre vos fiches.</p>
              <p>
                <strong>Besoin d'aide&nbsp;?</strong>{' '}
                <Link to="/app/tableau-de-bord/contact" className="fr-link">
                  Contactez-nous
                </Link>
              </p>
            </>
          }
        />
      </Section>
    );
  }

  return (
    <Section title={`Action du Premier détenteur | ${premierDetenteurInput}`}>
      <p className="mb-5 text-sm text-gray-500">
        * Les champs marqués d'un astérisque (*) sont obligatoires.
      </p>
      {waitingForPremierDetenteur && (
        <Alert
          severity="success"
          title="En attente du premier détenteur"
          description="Vous ne pouvez pas modifier la fiche car vous n'êtes pas le Premier Détenteur"
          className="mb-5"
        />
      )}
      <DestinatairePremierDetenteur
        canEdit={canEdit}
        disabled={showAsDisabled}
      />
    </Section>
  );
}
