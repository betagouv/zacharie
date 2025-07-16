import { useEffect, useMemo, /* useRef, */ useState } from 'react';
import { useParams } from 'react-router';
import { EntityRelationType, UserRoles } from '@prisma/client';
import useZustandStore from '@app/zustand/store';
import useUser from '@app/zustand/user';
import { loadFei } from '@app/utils/load-fei';
import FEIExaminateurInitial from './examinateur-initial';
import { refreshUser } from '@app/utils-offline/get-most-fresh-user';
import { loadMyRelations } from '@app/utils/load-my-relations';
import FeiTransfer from './current-owner-transfer';
import FEICurrentIntermediaire from './intermediaire';
import Chargement from '@app/components/Chargement';
import NotFound from '@app/components/NotFound';
import FEI_SVI from './svi';
import { useNextOwnerCollecteurProEntityId } from '@app/utils/collecteurs-pros';
import FeiStepper from '@app/components/FeiStepper';
import CurrentOwnerConfirm from './current-owner-confirm';
import DeleteFei from './delete-fei';
import { Button } from '@codegouvfr/react-dsfr/Button';

export default function FeiLoader() {
  const params = useParams();
  const feis = useZustandStore((state) => state.feis);
  const fei = feis[params.fei_numero!];
  const [hasTriedLoading, setHasTriedLoading] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    refreshUser('connexion')
      .then(loadMyRelations)
      .then(() => loadFei(params.fei_numero!))
      .then(() => {
        setHasTriedLoading(true);
      })
      .catch((error) => {
        setHasTriedLoading(true);
        console.error(error);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!fei) {
    return hasTriedLoading ? <NotFound /> : <Chargement />;
  }
  return <Fei key={fei.numero} />;
}

function Fei() {
  const params = useParams();
  const user = useUser((state) => state.user)!;
  const feis = useZustandStore((state) => state.feis);
  const fei = feis[params.fei_numero!];
  const getFeiIntermediairesForFeiNumero = useZustandStore((state) => state.getFeiIntermediairesForFeiNumero);
  const intermediaires = getFeiIntermediairesForFeiNumero(fei.numero);

  const entities = useZustandStore((state) => state.entities);

  const nextOwnerCollecteurProEntityId = useNextOwnerCollecteurProEntityId(fei, user);
  const nextOwnerEntity = fei.fei_next_owner_entity_id ? entities[fei.fei_next_owner_entity_id] : null;

  // const refCurrentRole = useRef(fei.fei_current_owner_role);
  // const refCurrentUserId = useRef(fei.fei_current_owner_user_id);

  const showInterface = useMemo(() => {
    /* 
    deprecated - was good when tabs in a useEffect, but now I dont think so
    if (fei.fei_current_owner_role !== refCurrentRole.current) {
      if (fei.fei_current_owner_user_id === user.id) {
        switch (fei.fei_current_owner_role) {
          case UserRoles.EXAMINATEUR_INITIAL:
            return UserRoles.EXAMINATEUR_INITIAL;
          case UserRoles.PREMIER_DETENTEUR:
            if (fei.examinateur_initial_user_id === user.id) {
              return UserRoles.EXAMINATEUR_INITIAL;
            } else {
              return UserRoles.PREMIER_DETENTEUR;
            }
          case UserRoles.SVI:
            return UserRoles.SVI;
          // default:
          //   return UserRoles.ETG;
        }
      }
    } 
    */
    if (user.roles.includes(UserRoles.EXAMINATEUR_INITIAL)) {
      if (fei.examinateur_initial_user_id === user.id) {
        return UserRoles.EXAMINATEUR_INITIAL;
      }
    }
    if (user.roles.includes(UserRoles.PREMIER_DETENTEUR)) {
      return UserRoles.PREMIER_DETENTEUR;
    }
    if (fei.fei_current_owner_role === UserRoles.SVI || fei.fei_next_owner_role === UserRoles.SVI) {
      if (user.roles.includes(UserRoles.SVI)) return UserRoles.SVI;
      if (user.roles.includes(UserRoles.ETG)) return UserRoles.ETG;
      if (user.roles.includes(UserRoles.COLLECTEUR_PRO)) return UserRoles.COLLECTEUR_PRO;
      return null;
    }
    if (
      fei.fei_current_owner_role === UserRoles.COLLECTEUR_PRO &&
      fei.fei_current_owner_user_id === user.id
    ) {
      return UserRoles.COLLECTEUR_PRO;
    }
    if (
      fei.fei_next_owner_role === UserRoles.COLLECTEUR_PRO &&
      nextOwnerCollecteurProEntityId &&
      nextOwnerEntity?.relation === EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY
    ) {
      return UserRoles.COLLECTEUR_PRO;
    }
    if (
      nextOwnerCollecteurProEntityId &&
      fei.fei_next_owner_role === UserRoles.ETG &&
      (user.roles.includes(UserRoles.ETG) || user.roles.includes(UserRoles.COLLECTEUR_PRO))
    ) {
      return UserRoles.COLLECTEUR_PRO;
    }
    if (
      user.roles.includes(UserRoles.ETG) &&
      (fei.fei_current_owner_role === UserRoles.ETG || fei.fei_next_owner_role === UserRoles.ETG)
    ) {
      return UserRoles.ETG;
    }
    if (fei.examinateur_initial_user_id === user.id) {
      return UserRoles.EXAMINATEUR_INITIAL;
    }
    if (user.roles.includes(UserRoles.PREMIER_DETENTEUR)) {
      return UserRoles.PREMIER_DETENTEUR;
    }
    if (intermediaires.length > 0) {
      const userWasIntermediaire = intermediaires.find(
        (intermediaire) => intermediaire.intermediaire_user_id === user.id,
      );
      if (userWasIntermediaire) {
        return userWasIntermediaire.intermediaire_role;
      }
    }
    return null;
  }, [
    fei.examinateur_initial_user_id,
    fei.fei_current_owner_role,
    fei.fei_current_owner_user_id,
    user.id,
    nextOwnerCollecteurProEntityId,
    user.roles,
    fei.fei_next_owner_role,
    intermediaires,
  ]);

  // useEffect(() => {
  //   refCurrentRole.current = fei.fei_current_owner_role;
  //   refCurrentUserId.current = fei.fei_current_owner_user_id;
  // }, [fei.examinateur_initial_user_id, fei.fei_current_owner_role, fei.fei_current_owner_user_id, user.id]);

  console.log({ showInterface });

  return (
    <>
      <title>
        {`${params.fei_numero} | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire`}
      </title>
      {fei.deleted_at && (
        <div className="bg-error-main-525 mb-2 py-2 text-center text-white">
          <p>Fiche supprimée</p>
        </div>
      )}
      <div className="fr-container fr-container--fluid fr-my-md-14v">
        <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
          <div className="fr-col-12 fr-col-md-10 bg-alt-blue-france [&_.fr-tabs\\_\\_list]:bg-alt-blue-france m-4 md:m-0 md:p-0">
            {showInterface === UserRoles.SVI && <h1 className="fr-h3 fr-mb-2w">Fiche {fei?.numero}</h1>}
            <FeiTransfer />
            {showInterface !== UserRoles.SVI && <CurrentOwnerConfirm />}
            {showInterface !== UserRoles.SVI && <FeiStepper />}
            {showInterface === UserRoles.COLLECTEUR_PRO && <FEICurrentIntermediaire />}
            {showInterface === UserRoles.EXAMINATEUR_INITIAL && <FEIExaminateurInitial />}
            {showInterface === UserRoles.PREMIER_DETENTEUR && <FEIExaminateurInitial />}
            {showInterface === UserRoles.ETG && <FEICurrentIntermediaire />}
            {showInterface === UserRoles.SVI && <FEI_SVI />}
            <div className="m-8 flex flex-col justify-start gap-4">
              <Button
                linkProps={{
                  to: `/app/tableau-de-bord/`,
                }}
              >
                Voir toutes mes fiches
              </Button>
              <DeleteFei />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
