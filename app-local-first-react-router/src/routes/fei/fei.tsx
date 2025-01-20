import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { Tabs, type TabsProps } from '@codegouvfr/react-dsfr/Tabs';
import { UserRoles } from '@prisma/client';
import useZustandStore from '@app/zustand/store';
import useUser from '@app/zustand/user';
import { loadFei } from '@app/utils/load-fei';
import FEIExaminateurInitial from './examinateur-initial';
import { refreshUser } from '@app/utils-offline/get-most-fresh-user';
import { loadMyRelations } from '@app/utils/load-my-relations';
import FeiTransfer from './current-owner-transfer';
import CurrentOwnerConfirm from './current-owner-confirm';
import CurrentOwner from './current-owner';
import FeiPremierDetenteur from './premier-detenteur';
import FEICurrentIntermediaire from './intermediaire';
import Chargement from '@app/components/Chargement';
import NotFound from '@app/components/NotFound';
import FEI_SVI from './svi';

export default function FeiLoader() {
  const params = useParams();
  const state = useZustandStore((state) => state);
  const fei = state.feis[params.fei_numero!];
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
  }, []);

  if (!fei) {
    return hasTriedLoading ? <NotFound /> : <Chargement />;
  }
  return <Fei key={fei.numero} />;
}

function Fei() {
  const params = useParams();
  const user = useUser((state) => state.user)!;
  const state = useZustandStore((state) => state);
  const fei = state.feis[params.fei_numero!];
  const intermediaires = state.getFeiIntermediairesForFeiNumero(fei.numero);

  // const entities = useZustandStore((state) => state.entities);
  const nextOwnerEntity = fei.fei_next_owner_entity_id ? state.entities[fei.fei_next_owner_entity_id] : null;

  const doneEmoji = '✅ ';

  const tabs: TabsProps['tabs'] = [
    {
      tabId: UserRoles.EXAMINATEUR_INITIAL,
      label: (
        <>
          <span className="hidden md:inline">
            {fei.examinateur_initial_approbation_mise_sur_le_marche ? doneEmoji : ''}Examinateur Initial
          </span>
          <span className="inline md:hidden">
            {fei.examinateur_initial_approbation_mise_sur_le_marche ? doneEmoji : ''}Examinateur
          </span>
        </>
      ),
    },
    {
      tabId: UserRoles.PREMIER_DETENTEUR,
      label: (
        <>
          <span className="hidden md:inline">
            {fei.premier_detenteur_date_depot_quelque_part ? doneEmoji : ''}Premier Détenteur
          </span>
          <span className="inline md:hidden">
            {fei.premier_detenteur_date_depot_quelque_part ? doneEmoji : ''}Détenteur
          </span>
        </>
      ),
    },
    { tabId: 'Destinataires', label: <>{fei.svi_entity_id ? doneEmoji : ''}Destinataires</> },
    {
      tabId: UserRoles.SVI,
      label: (
        <>
          <span className="hidden md:inline">
            {fei.svi_user_id ? doneEmoji : ''}Service Vétérinaire d'Inspection (SVI)
          </span>
          <span className="inline md:hidden">{fei.svi_user_id ? doneEmoji : ''}SVI</span>
        </>
      ),
    },
  ];

  const [selectedTabId, setSelectedTabId] = useState<(typeof tabs)[number]['tabId']>(() => {
    if (fei.fei_current_owner_role === UserRoles.SVI) {
      return UserRoles.SVI;
    }
    if (
      fei.fei_current_owner_role &&
      (['COLLECTEUR_PRO', 'ETG'] as UserRoles[]).includes(fei.fei_current_owner_role)
    ) {
      return 'Destinataires';
    }
    return UserRoles.EXAMINATEUR_INITIAL;
    // return "Destinataires";
  });

  const refCurrentRole = useRef(fei.fei_current_owner_role);
  const refCurrentUserId = useRef(fei.fei_current_owner_user_id);
  useEffect(() => {
    if (fei.fei_current_owner_role !== refCurrentRole.current) {
      if (fei.fei_current_owner_user_id === user.id) {
        switch (fei.fei_current_owner_role) {
          case UserRoles.EXAMINATEUR_INITIAL:
            setSelectedTabId(UserRoles.EXAMINATEUR_INITIAL);
            break;
          case UserRoles.PREMIER_DETENTEUR:
            if (fei.examinateur_initial_user_id === user.id) {
              setSelectedTabId(UserRoles.EXAMINATEUR_INITIAL);
            } else {
              setSelectedTabId(UserRoles.PREMIER_DETENTEUR);
            }
            break;
          case UserRoles.SVI:
            // window.scrollTo({ top: 0, behavior: "smooth" });
            setSelectedTabId(UserRoles.SVI);
            break;
          default:
            // window.scrollTo({ top: 0, behavior: "smooth" });
            setSelectedTabId('Destinataires');
            break;
        }
      }
    }
    refCurrentRole.current = fei.fei_current_owner_role;
    refCurrentUserId.current = fei.fei_current_owner_user_id;
  }, [fei.examinateur_initial_user_id, fei.fei_current_owner_role, fei.fei_current_owner_user_id, user.id]);

  const intermediaireTabDisabledText = useMemo(() => {
    const intermediaire = intermediaires[0];
    if (intermediaire) {
      return '';
    }
    const nextIntermediaireId = fei.fei_next_owner_entity_id;
    if (!nextIntermediaireId) {
      return "Il n'y a pas encore de premier destinataire sélectionné";
    }
    let base = `Le prochain destinataire est&nbsp;: ${nextOwnerEntity?.nom_d_usage}.`;
    if (fei.fei_current_owner_user_id === user.id) {
      base += `<br />La fiche n'a pas encore été prise en charge par ce destinataire.`;
    }
    return base;
  }, [
    fei.fei_next_owner_entity_id,
    intermediaires,
    nextOwnerEntity,
    user?.id,
    fei.fei_current_owner_user_id,
  ]);

  const sviTabDisabledText = useMemo(() => {
    if (!fei.svi_assigned_at) {
      return "Le service vétérinaire n'a pas encore été assigné";
    }
    if (user.roles.includes(UserRoles.SVI)) {
      return '';
    }
    if (!fei.svi_signed_at && !fei.automatic_closed_at) {
      return "Le service vétérinaire n'a pas encore terminé son inspection";
    }
    // if (!user.roles.includes(UserRoles.SVI)) {
    //   return "Vous n'êtes pas le service vétérinaire";
    // }
    return '';
  }, [fei.svi_assigned_at, fei.svi_signed_at, fei.automatic_closed_at, user]);

  return (
    <>
      {fei.deleted_at && (
        <div className="bg-red-500 text-white py-2 text-center mb-2">
          <p>Fiche supprimée</p>
        </div>
      )}
      <div className="fr-container fr-container--fluid fr-my-md-14v">
        <title>{params.fei_numero} | Zacharie | Ministère de l'Agriculture</title>
        <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
          <div className="fr-col-12 fr-col-md-10 m-4 bg-white md:m-0 md:p-0 [&_.fr-tabs\\_\\_list]:bg-alt-blue-france">
            <FeiTransfer />
            <CurrentOwnerConfirm setSelectedTabId={setSelectedTabId} />
            <CurrentOwner />
            <Tabs selectedTabId={selectedTabId} tabs={tabs} onTabChange={setSelectedTabId}>
              {selectedTabId === UserRoles.EXAMINATEUR_INITIAL && <FEIExaminateurInitial />}
              {selectedTabId === UserRoles.PREMIER_DETENTEUR && <FeiPremierDetenteur showIdentity />}
              {selectedTabId === 'Destinataires' &&
                (intermediaireTabDisabledText ? (
                  <p dangerouslySetInnerHTML={{ __html: intermediaireTabDisabledText }} />
                ) : (
                  <FEICurrentIntermediaire />
                ))}
              {selectedTabId === UserRoles.SVI &&
                (sviTabDisabledText ? (
                  <p dangerouslySetInnerHTML={{ __html: sviTabDisabledText }} />
                ) : (
                  <FEI_SVI />
                ))}
            </Tabs>
          </div>
        </div>
      </div>
    </>
  );
}
