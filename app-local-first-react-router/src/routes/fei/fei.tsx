import { useEffect, useMemo, /* useRef, */ useState } from 'react';
import { useParams } from 'react-router';
import { EntityRelationType, FeiOwnerRole, UserRoles } from '@prisma/client';
import useZustandStore from '@app/zustand/store';
import useUser from '@app/zustand/user';
import { loadFei } from '@app/utils/load-fei';
import FEIExaminateurInitial from './examinateur-initial';
import { refreshUser } from '@app/utils-offline/get-most-fresh-user';
import { loadMyRelations } from '@app/utils/load-my-relations';
import FeiSousTraite from './current-owner-sous-traite';
import FEICurrentIntermediaire from './intermediaire';
import Chargement from '@app/components/Chargement';
import NotFound from '@app/components/NotFound';
import FEI_SVI from './svi';
import FeiStepper from '@app/components/FeiStepper';
import CurrentOwnerConfirm from './current-owner-confirm';
import DeleteFei from './delete-fei';
import { Button } from '@codegouvfr/react-dsfr/Button';
import CircuitCourt from './circuirt-court';

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
  const isCircuitCourt =
    user.roles.includes(UserRoles.COMMERCE_DE_DETAIL) ||
    user.roles.includes(UserRoles.REPAS_DE_CHASSE_OU_ASSOCIATIF) ||
    user.roles.includes(UserRoles.CONSOMMATEUR_FINAL);
  const feis = useZustandStore((state) => state.feis);
  const fei = feis[params.fei_numero!];
  const getFeiIntermediairesForFeiNumero = useZustandStore((state) => state.getFeiIntermediairesForFeiNumero);
  const intermediaires = getFeiIntermediairesForFeiNumero(fei.numero);

  const entities = useZustandStore((state) => state.entities);

  const nextOwnerEntity = fei.fei_next_owner_entity_id ? entities[fei.fei_next_owner_entity_id] : null;

  // const refCurrentRole = useRef(fei.fei_current_owner_role);
  // const refCurrentUserId = useRef(fei.fei_current_owner_user_id);

  const showInterface: FeiOwnerRole | null = useMemo(() => {
    if (user.roles.includes(UserRoles.CHASSEUR)) {
      if (fei.examinateur_initial_user_id === user.id) {
        return FeiOwnerRole.EXAMINATEUR_INITIAL;
      }
      return FeiOwnerRole.PREMIER_DETENTEUR;
    }

    if (fei.fei_current_owner_role === FeiOwnerRole.SVI || fei.fei_next_owner_role === FeiOwnerRole.SVI) {
      if (user.roles.includes(UserRoles.SVI)) return FeiOwnerRole.SVI;
      if (user.roles.includes(UserRoles.ETG)) return FeiOwnerRole.ETG;
      if (user.roles.includes(UserRoles.COLLECTEUR_PRO)) return FeiOwnerRole.COLLECTEUR_PRO;
      return null;
    }
    if (
      fei.fei_current_owner_role === FeiOwnerRole.COLLECTEUR_PRO &&
      fei.fei_current_owner_user_id === user.id
    ) {
      return FeiOwnerRole.COLLECTEUR_PRO;
    }
    if (
      fei.fei_next_owner_role === FeiOwnerRole.COLLECTEUR_PRO &&
      nextOwnerEntity?.relation === EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY
    ) {
      return FeiOwnerRole.COLLECTEUR_PRO;
    }
    if (
      fei.fei_current_owner_role === FeiOwnerRole.COLLECTEUR_PRO &&
      fei.fei_next_owner_role === FeiOwnerRole.ETG &&
      (user.roles.includes(UserRoles.ETG) || user.roles.includes(UserRoles.COLLECTEUR_PRO))
    ) {
      return FeiOwnerRole.COLLECTEUR_PRO;
    }
    if (
      user.roles.includes(UserRoles.ETG) &&
      (fei.fei_current_owner_role === FeiOwnerRole.ETG || fei.fei_next_owner_role === FeiOwnerRole.ETG)
    ) {
      return FeiOwnerRole.ETG;
    }
    if (intermediaires.length > 0) {
      const userWasIntermediaire = intermediaires.find(
        (intermediaire) => intermediaire.intermediaire_user_id === user.id,
      );
      if (userWasIntermediaire) {
        return userWasIntermediaire.intermediaire_role;
      }
    }
    if (isCircuitCourt) {
      return user.roles[0] as FeiOwnerRole;
    }
    return null;
  }, [
    user.roles,
    user.id,
    fei.fei_current_owner_role,
    fei.fei_next_owner_role,
    fei.fei_current_owner_user_id,
    fei.examinateur_initial_user_id,
    nextOwnerEntity?.relation,
    intermediaires,
    isCircuitCourt,
  ]);

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
          <div
            className="fr-col-12 fr-col-md-10 bg-alt-blue-france [&_.fr-tabs\\_\\_list]:bg-alt-blue-france m-4 md:m-0 md:p-0"
            key={fei.fei_current_owner_entity_id! + fei.fei_current_owner_user_id!}
          >
            {(showInterface === FeiOwnerRole.SVI || isCircuitCourt) && (
              <h1 className="fr-h3 fr-mb-2w">Fiche {fei?.numero}</h1>
            )}
            <FeiSousTraite />
            {showInterface !== FeiOwnerRole.SVI && <CurrentOwnerConfirm />}
            {showInterface !== FeiOwnerRole.SVI && !isCircuitCourt && <FeiStepper />}
            {showInterface === FeiOwnerRole.COLLECTEUR_PRO && <FEICurrentIntermediaire />}
            {showInterface === FeiOwnerRole.EXAMINATEUR_INITIAL && <FEIExaminateurInitial />}
            {showInterface === FeiOwnerRole.PREMIER_DETENTEUR && <FEIExaminateurInitial />}
            {showInterface === FeiOwnerRole.ETG && <FEICurrentIntermediaire />}
            {showInterface === FeiOwnerRole.SVI && <FEI_SVI />}
            {isCircuitCourt && <CircuitCourt />}
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
