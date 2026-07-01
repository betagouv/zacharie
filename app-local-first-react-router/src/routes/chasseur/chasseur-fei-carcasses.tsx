import NouvelleCarcasse from './examinateur-carcasses-nouvelle';
import { UserRoles } from '@prisma/client';
import { useMemo, useState } from 'react';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { formatCarcasseLotCount, formatCountCarcasseByEspece } from '@app/utils/count-carcasses';
import { useParams, useNavigate } from 'react-router';
import useUser from '@app/zustand/user';
import useZustandStore from '@app/zustand/store';
import { useCarcassesForFei } from '@app/utils/get-carcasses-for-fei';
import dayjs from 'dayjs';
import { createHistoryInput } from '@app/utils/create-history-entry';
import CardCarcasse from '@app/components/CardCarcasse';
import type { Carcasse } from '@prisma/client';

export default function CarcassesExaminateur({
  canEdit,
  canEditAsPremierDetenteur,
  allCarcassesConfirmed,
  onAllCarcassesConfirmed,
  onAddMoreCarcasses,
}: {
  canEdit: boolean;
  canEditAsPremierDetenteur: boolean;
  allCarcassesConfirmed: boolean;
  onAllCarcassesConfirmed: () => void;
  onAddMoreCarcasses: () => void;
}) {
  const params = useParams();
  const feis = useZustandStore((state) => state.feis);
  const fei_numero = params.fei_numero!;
  const fei = feis[fei_numero];
  const entities = useZustandStore((state) => state.entities);
  const carcasses = useCarcassesForFei(fei_numero);
  const [showForm, setShowForm] = useState(!allCarcassesConfirmed);

  const countCarcassesByEspece = useMemo(() => formatCountCarcasseByEspece(carcasses), [carcasses]);

  const hasCarcasses = carcasses.length > 0;
  const lastEspece = hasCarcasses ? carcasses[carcasses.length - 1].espece : null;

  const { restantes, dejaEnvoyeesParDestinataire } = useMemo(() => {
    const restantesList: Carcasse[] = [];
    const grouped: Record<string, Carcasse[]> = {};
    for (const c of carcasses) {
      // Côté chasseur, on ne regroupe que par le destinataire choisi par le premier détenteur.
      // Le reste de la chaîne aval (ETG suivant, SVI…) ne le concerne pas.
      const destinataireId = c.premier_detenteur_prochain_detenteur_id_cache;
      if (!destinataireId) {
        restantesList.push(c);
        continue;
      }
      if (!grouped[destinataireId]) grouped[destinataireId] = [];
      grouped[destinataireId].push(c);
    }
    return { restantes: restantesList, dejaEnvoyeesParDestinataire: grouped };
  }, [carcasses]);

  const hasGroups = Object.keys(dejaEnvoyeesParDestinataire).length > 0;

  return (
    <>
      {hasGroups ? (
        <div className="flex flex-col gap-4">
          {restantes.length > 0 && (
            <div>
              <p className="mt-0 mb-2 text-sm text-gray-500">
                À attribuer ({formatCarcasseLotCount(restantes)})
              </p>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {restantes.map((carcasse: Carcasse) => (
                  <CarcasseExaminateur
                    key={carcasse.numero_bracelet}
                    carcasse={carcasse}
                    canEditAsExaminateurInitial={canEdit}
                    canEditAsPremierDetenteur={canEditAsPremierDetenteur}
                  />
                ))}
              </div>
            </div>
          )}
          {Object.entries(dejaEnvoyeesParDestinataire).map(([entityId, group]) => (
            <div key={entityId}>
              <p className="mt-0 mb-2 text-sm text-gray-500">
                Envoyée à {entities[entityId]?.nom_d_usage ?? 'destinataire inconnu'} (
                {formatCarcasseLotCount(group)})
              </p>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {group.map((carcasse: Carcasse) => (
                  <CarcasseExaminateur
                    key={carcasse.numero_bracelet}
                    carcasse={carcasse}
                    canEditAsExaminateurInitial={canEdit}
                    canEditAsPremierDetenteur={canEditAsPremierDetenteur}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {carcasses.map((carcasse: Carcasse) => (
            <CarcasseExaminateur
              key={carcasse.numero_bracelet}
              carcasse={carcasse}
              canEditAsExaminateurInitial={canEdit}
              canEditAsPremierDetenteur={canEditAsPremierDetenteur}
            />
          ))}
        </div>
      )}
      {(!hasCarcasses || (showForm && !allCarcassesConfirmed)) && canEdit && (
        <div className="my-2">
          <NouvelleCarcasse
            key={`${fei.commune_mise_a_mort}-${lastEspece}`}
            defaultEspece={lastEspece ?? undefined}
            onCarcasseAdded={() => setShowForm(false)}
          />
        </div>
      )}

      {canEdit && hasCarcasses && !allCarcassesConfirmed && !showForm && (
        <div className="mt-4">
          <Button
            type="button"
            id="add-more-carcasses-button"
            priority="secondary"
            iconId="fr-icon-add-line"
            onClick={() => setShowForm(true)}
          >
            Ajouter une autre carcasse
          </Button>
        </div>
      )}
      {canEdit && hasCarcasses && (
        <p className="my-4 ml-4 text-sm text-gray-500">
          Carcasses enregistrées sur cette fiche&nbsp;:
          {countCarcassesByEspece.map((line) => (
            <span
              className="ml-4 block"
              key={line}
            >
              {line}
            </span>
          ))}
        </p>
      )}
      {canEdit && hasCarcasses && !allCarcassesConfirmed && (
        <div className="mt-4">
          <Button
            type="button"
            priority="primary"
            onClick={() => {
              onAllCarcassesConfirmed();
            }}
          >
            Continuer
          </Button>
        </div>
      )}
      {canEdit && hasCarcasses && allCarcassesConfirmed && (
        <Button
          type="button"
          id="add-more-carcasses"
          priority="secondary"
          className="mt-4"
          iconId="fr-icon-add-line"
          onClick={() => {
            onAddMoreCarcasses();
            setShowForm(true);
          }}
        >
          Ajouter une autre carcasse
        </Button>
      )}
    </>
  );
}

export function CarcasseExaminateur({
  carcasse,
  canEditAsPremierDetenteur,
  canEditAsExaminateurInitial,
}: {
  carcasse: Carcasse;
  canEditAsPremierDetenteur?: boolean;
  canEditAsExaminateurInitial?: boolean;
}) {
  const user = useUser((state) => state.user)!;
  const updateCarcasse = useZustandStore((state) => state.updateCarcasse);
  const addLog = useZustandStore((state) => state.addLog);
  const navigate = useNavigate();

  if (!canEditAsExaminateurInitial && !canEditAsPremierDetenteur) {
    return <CardCarcasse carcasse={carcasse} />;
  }
  return (
    <CardCarcasse
      carcasse={carcasse}
      onEdit={
        !canEditAsExaminateurInitial
          ? undefined
          : () => {
              navigate(`/app/chasseur/carcasse/${carcasse.fei_numero}/${carcasse.zacharie_carcasse_id}`);
            }
      }
      onClick={
        !canEditAsExaminateurInitial
          ? undefined
          : () => {
              navigate(`/app/chasseur/carcasse/${carcasse.fei_numero}/${carcasse.zacharie_carcasse_id}`);
            }
      }
      onDelete={
        !canEditAsExaminateurInitial && !canEditAsPremierDetenteur
          ? undefined
          : () => {
              if (window.confirm('Voulez-vous supprimer cette carcasse ? Cette opération est irréversible')) {
                const nextPartialCarcasse: Partial<Carcasse> = {
                  deleted_at: dayjs().toDate(),
                };
                updateCarcasse(carcasse.zacharie_carcasse_id, nextPartialCarcasse);
                addLog({
                  user_id: user.id,
                  user_role: UserRoles.CHASSEUR,
                  fei_numero: carcasse.fei_numero,
                  action: 'examinateur-carcasse-delete',
                  history: createHistoryInput(carcasse, nextPartialCarcasse),
                  entity_id: null,
                  zacharie_carcasse_id: carcasse.zacharie_carcasse_id,
                  intermediaire_id: null,
                  carcasse_intermediaire_id: null,
                });
              }
            }
      }
    />
  );
}
