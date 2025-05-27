import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { CarcasseType, UserRoles } from '@prisma/client';
import dayjs from 'dayjs';
import CarcasseSVI from '../fei/svi-carcasse';
import { Breadcrumb } from '@codegouvfr/react-dsfr/Breadcrumb';
import InputNotEditable from '@app/components/InputNotEditable';
import useUser from '@app/zustand/user';
import useZustandStore from '@app/zustand/store';
import { getCarcasseIntermediaireId } from '@app/utils/get-carcasse-intermediaire-id';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { refreshUser } from '@app/utils-offline/get-most-fresh-user';
import { loadFei } from '@app/utils/load-fei';
import { loadMyRelations } from '@app/utils/load-my-relations';
import NotFound from '@app/components/NotFound';
import Chargement from '@app/components/Chargement';
import { CarcasseIPM1 } from './ipm1';
import { CarcasseIPM2 } from './ipm2';
import CarcasseSVICertificats from './certificats';
import FEIDonneesDeChasse from '../fei/donnees-de-chasse';

export default function CarcasseSviLoader() {
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
  }, [params.fei_numero]);

  if (!fei) {
    return hasTriedLoading ? <NotFound /> : <Chargement />;
  }
  return <CarcasseEditSVI key={fei.numero} />;
}

export function CarcasseEditSVI() {
  const params = useParams();
  const user = useUser((state) => state.user)!;
  const state = useZustandStore((state) => state);
  const navigate = useNavigate();
  const fei = state.feis[params.fei_numero!];
  const intermediaires = state.getFeiIntermediairesForFeiNumero(fei.numero);
  const carcasse = state.carcasses[params.zacharie_carcasse_id!];

  const commentairesIntermediaires = useMemo(() => {
    const commentaires = [];
    for (const intermediaire of intermediaires) {
      const carcassesIntermediairesId = getCarcasseIntermediaireId(
        fei.numero,
        carcasse.numero_bracelet,
        intermediaire.id,
      );
      const intermediaireCarcasse = state.carcassesIntermediaires[carcassesIntermediairesId];
      if (intermediaireCarcasse?.commentaire) {
        const intermediaireEntity = state.entities[intermediaire.fei_intermediaire_entity_id];
        commentaires.push(`${intermediaireEntity?.nom_d_usage} : ${intermediaireCarcasse?.commentaire}`);
      }
    }
    return commentaires;
  }, [carcasse.numero_bracelet, fei.numero, intermediaires, state.carcassesIntermediaires, state.entities]);

  const isSviWorkingFor = useMemo(() => {
    // if (fei.fei_current_owner_role === UserRoles.SVI && !!fei.svi_entity_id) {
    // fix: pas besoin d'avoir pris en charge la fiche pour les SVI, elle est prise en charge automatiquement
    if (fei.svi_entity_id) {
      if (user.roles.includes(UserRoles.SVI)) {
        const svi = state.entities[fei.svi_entity_id];
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
    // if (fei.fei_current_owner_user_id !== user.id) {
    //   return false;
    // }
    // if (fei.svi_signed_at) {
    //   return false;
    // }
    // if (fei.automatic_closed_at) {
    //   return false;
    // }
    if (fei.fei_current_owner_role !== UserRoles.SVI) {
      return false;
    }
    if (!user.roles.includes(UserRoles.SVI)) {
      return false;
    }
    return true;
  }, [fei, user, isSviWorkingFor]);

  return (
    <div className="fr-container fr-container--fluid fr-my-md-14v">
      <title>
        {`${carcasse.numero_bracelet} - ${carcasse.type === CarcasseType.PETIT_GIBIER ? 'Lot de carcasses de petit gibier' : 'Carcasse de grand gibier'}`}{' '}
        - Zacharie
      </title>
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
          <h1 className="fr-h3 fr-mb-2w">
            {carcasse.numero_bracelet} - {carcasse.espece}
          </h1>
          <Breadcrumb
            className="[&_a]:!text-base"
            currentPageLabel={`Carcasse ${carcasse.numero_bracelet}`}
            segments={[
              {
                label: 'Fiches',
                linkProps: {
                  to: '/app/tableau-de-bord',
                  href: '#',
                },
              },
              {
                label: fei.numero,
                linkProps: {
                  to: `/app/tableau-de-bord/fei/${fei.numero}`,
                  href: '#',
                },
              },
            ]}
          />
          <details className="bg-white p-4 md:p-8">
            <summary>
              <h3 className="ml-2 inline text-lg font-semibold text-gray-900">
                Infos sur la chasse et{' '}
                {carcasse.type === CarcasseType.PETIT_GIBIER ? 'le lot de carcasses' : 'la carcasse'}
              </h3>
            </summary>
            <div className="p-5">
              <>
                <FEIDonneesDeChasse carcasseId={carcasse.zacharie_carcasse_id} />
                {carcasse.type === CarcasseType.PETIT_GIBIER && (
                  <InputNotEditable
                    label="Nombre d'animaux initialement prélevés"
                    nativeInputProps={{
                      defaultValue: carcasse.nombre_d_animaux!,
                    }}
                  />
                )}
                <InputNotEditable
                  label="Commentaires des destinataires"
                  textArea
                  nativeTextAreaProps={{
                    rows: commentairesIntermediaires.length,
                    defaultValue: commentairesIntermediaires.join('\n'),
                  }}
                />
              </>
            </div>
          </details>
          {canEdit && (
            <>
              <details open={!carcasse.svi_ipm1_decision} className="mt-8 bg-white p-4 md:p-8">
                <summary>
                  <h3 className="ml-2 inline text-lg font-semibold text-gray-900">
                    {`Inspection Post-Mortem 1 (IPM1)${carcasse.svi_ipm1_date ? ` - ${dayjs(carcasse.svi_ipm1_date).format('DD-MM-YYYY')}` : ''}`}
                  </h3>
                </summary>
                <div className="p-5">
                  <CarcasseIPM1 canEdit={canEdit} />
                </div>
              </details>
              <details open={!carcasse.svi_ipm2_decision} className="mt-8 bg-white p-4 md:p-8">
                <summary>
                  <h3 className="ml-2 inline text-lg font-semibold text-gray-900">
                    {`Inspection Post-Mortem 2 (IPM2)${carcasse.svi_ipm2_date ? ` - ${dayjs(carcasse.svi_ipm2_date).format('DD-MM-YYYY')}` : ''}`}
                  </h3>
                </summary>
                <div className="p-5">
                  <CarcasseIPM2 canEdit={canEdit} />
                </div>
              </details>
            </>
          )}

          <details open className="mt-8 bg-white p-4 md:p-8">
            <summary>
              <h2 className="ml-2 inline text-lg font-semibold text-gray-900">Résumé de la décision</h2>
            </summary>
            <div className="p-5">
              <CarcasseSVI
                carcasse={carcasse}
                canEdit={false}
                key={dayjs(carcasse.updated_at).toISOString()}
              />
            </div>
          </details>

          {user.roles.includes(UserRoles.SVI) && (
            <details open className="mt-8 bg-white p-4 md:p-8">
              <summary>
                <h2 className="ml-2 inline text-lg font-semibold text-gray-900">Certificats</h2>
              </summary>
              <div className="p-5">
                <CarcasseSVICertificats />
              </div>
            </details>
          )}

          <div className="mt-4">
            <Button
              nativeButtonProps={{
                onClick: () => {
                  navigate(-1);
                },
              }}
            >
              Retour
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
