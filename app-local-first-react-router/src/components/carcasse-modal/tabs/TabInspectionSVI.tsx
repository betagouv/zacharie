import { useMemo, type ReactNode } from 'react';
import dayjs from 'dayjs';
import type { Carcasse } from '@prisma/client';
import { CarcasseType, IPM1Decision, IPM2Decision, PoidsType } from '@prisma/client';
import { Button } from '@codegouvfr/react-dsfr/Button';
import type { CarcasseCapabilities } from '@app/utils/carcasse-permissions';
import type { CardAccent } from '@app/utils/get-carcasse-card-display';
import { ModalCard } from '../_helpers';

interface TabInspectionSVIProps {
  carcasse: Carcasse;
  feiNumero: string;
  capabilities: CarcasseCapabilities;
  sviAccent: CardAccent;
  onAfterNavigate?: () => void;
}

export default function TabInspectionSVI({
  carcasse,
  feiNumero,
  capabilities,
  sviAccent,
  onAfterNavigate,
}: TabInspectionSVIProps) {
  const ipm1Lines = useMemo<Array<ReactNode>>(() => {
    if (!carcasse.svi_ipm1_date) return [];
    const lines: Array<ReactNode> = [];
    lines.push(`Date de l'inspection : ${dayjs(carcasse.svi_ipm1_date).format('dddd D MMMM YYYY')}`);
    if (!carcasse.svi_ipm1_presentee_inspection) {
      lines.push('Carcasse manquante');
      return lines;
    }
    if (carcasse.type === CarcasseType.PETIT_GIBIER) {
      lines.push(`Nombre d'animaux : ${carcasse.svi_ipm1_nombre_animaux ?? '—'}`);
    }
    if (carcasse.svi_ipm1_commentaire) {
      lines.push(`Commentaire de l'inspection : ${carcasse.svi_ipm1_commentaire}`);
    }
    if (carcasse.svi_ipm1_pieces.length) {
      lines.push(
        <>
          <p className="with-marker">Pièces observées&nbsp;:</p>
          <ul className="ml-4 list-inside list-decimal">
            {carcasse.svi_ipm1_pieces.map((piece, idx) => (
              <li key={idx}>{piece}</li>
            ))}
          </ul>
        </>
      );
    }
    if (carcasse.svi_ipm1_lesions_ou_motifs.length) {
      lines.push(
        <>
          <p className="with-marker">Lésions ou motifs de consigne&nbsp;:</p>
          <ul className="ml-4 list-inside list-decimal">
            {carcasse.svi_ipm1_lesions_ou_motifs.map((type, idx) => (
              <li key={idx}>{type}</li>
            ))}
          </ul>
        </>
      );
    }
    switch (carcasse.svi_ipm1_decision) {
      case IPM1Decision.NON_RENSEIGNEE:
        lines.push('Non renseigné');
        break;
      case IPM1Decision.ACCEPTE:
        lines.push('Décision : Acceptée');
        break;
      case IPM1Decision.MISE_EN_CONSIGNE:
        lines.push('Décision : Mise en consigne');
        break;
    }
    if (carcasse.svi_ipm1_decision === IPM1Decision.MISE_EN_CONSIGNE) {
      lines.push(`Durée de la consigne : ${carcasse.svi_ipm1_duree_consigne ?? '—'} heures`);
      if (carcasse.svi_ipm1_poids_consigne) {
        lines.push(`Poids de la consigne : ${carcasse.svi_ipm1_poids_consigne}kg`);
      }
    }
    return lines;
  }, [carcasse]);

  const ipm2Lines = useMemo<Array<ReactNode>>(() => {
    if (!carcasse.svi_ipm2_date) return [];
    const lines: Array<ReactNode> = [];
    lines.push(`Date de l'inspection : ${dayjs(carcasse.svi_ipm2_date).format('dddd D MMMM YYYY')}`);
    if (!carcasse.svi_ipm2_presentee_inspection) {
      lines.push('Carcasse manquante');
      return lines;
    }
    if (carcasse.type === CarcasseType.PETIT_GIBIER) {
      lines.push(`Nombre d'animaux : ${carcasse.svi_ipm2_nombre_animaux ?? '—'}`);
    }
    if (carcasse.svi_ipm2_commentaire) {
      lines.push(`Commentaire de l'inspection : ${carcasse.svi_ipm2_commentaire}`);
    }
    if (carcasse.svi_ipm2_pieces.length) {
      lines.push(
        <>
          <p className="with-marker">Pièces observées&nbsp;:</p>
          <ul className="ml-4 list-inside list-decimal">
            {carcasse.svi_ipm2_pieces.map((piece, idx) => (
              <li key={idx}>{piece}</li>
            ))}
          </ul>
        </>
      );
    }
    if (carcasse.svi_ipm2_lesions_ou_motifs.length) {
      lines.push(
        <>
          <p className="with-marker">Lésions ou motifs de consigne&nbsp;:</p>
          <ul className="ml-4 list-inside list-decimal">
            {carcasse.svi_ipm2_lesions_ou_motifs.map((type, idx) => (
              <li key={idx}>{type}</li>
            ))}
          </ul>
        </>
      );
    }
    switch (carcasse.svi_ipm2_decision) {
      case IPM2Decision.NON_RENSEIGNEE:
        lines.push('Pas de saisie');
        break;
      case IPM2Decision.LEVEE_DE_LA_CONSIGNE:
        lines.push('Décision : Levée de la consigne, pas de saisie');
        break;
      case IPM2Decision.SAISIE_TOTALE:
        lines.push('Décision : Saisie totale');
        break;
      case IPM2Decision.SAISIE_PARTIELLE:
        lines.push('Décision IPM2 : Saisie partielle');
        break;
      case IPM2Decision.TRAITEMENT_ASSAINISSANT:
        lines.push('Décision IPM2 : Traitement assainissant');
        break;
    }
    if (carcasse.svi_ipm2_traitement_assainissant_cuisson_temps) {
      lines.push(`Temps de cuisson : ${carcasse.svi_ipm2_traitement_assainissant_cuisson_temps}`);
    }
    if (carcasse.svi_ipm2_traitement_assainissant_cuisson_temp) {
      lines.push(
        `Température de cuisson : ${carcasse.svi_ipm2_traitement_assainissant_cuisson_temp}`
      );
    }
    if (carcasse.svi_ipm2_traitement_assainissant_congelation_temps) {
      lines.push(
        `Temps de congélation : ${carcasse.svi_ipm2_traitement_assainissant_congelation_temps}`
      );
    }
    if (carcasse.svi_ipm2_traitement_assainissant_congelation_temp) {
      lines.push(
        `Température de congélation : ${carcasse.svi_ipm2_traitement_assainissant_congelation_temp}`
      );
    }
    if (carcasse.svi_ipm2_traitement_assainissant_type) {
      lines.push(`Type de traitement : ${carcasse.svi_ipm2_traitement_assainissant_type}`);
    }
    if (carcasse.svi_ipm2_traitement_assainissant_paramètres) {
      lines.push(`Paramètres : ${carcasse.svi_ipm2_traitement_assainissant_paramètres}`);
    }
    if (carcasse.svi_ipm2_traitement_assainissant_etablissement) {
      lines.push(
        `Établissement désigné pour réaliser le traitement assainissant : ${carcasse.svi_ipm2_traitement_assainissant_etablissement}`
      );
    }
    if (carcasse.svi_ipm2_traitement_assainissant_poids) {
      lines.push(`Poids : ${carcasse.svi_ipm2_traitement_assainissant_poids}`);
    }
    if (carcasse.svi_ipm2_poids_saisie) {
      let poids = `Poids : ${carcasse.svi_ipm2_poids_saisie}`;
      if (carcasse.svi_ipm2_poids_type === PoidsType.DEPOUILLE) poids += ' (dépouillée/plumée)';
      if (carcasse.svi_ipm2_poids_type === PoidsType.NON_DEPOUILLE) poids += ' (non dépouillée/non plumée)';
      lines.push(poids);
    }
    return lines;
  }, [carcasse]);

  const sviInspectionPath = `/app/svi/carcasse-svi/${feiNumero}/${carcasse.zacharie_carcasse_id}`;

  return (
    <div className="pt-4">
      {capabilities.canActSvi && (
        <ModalCard
          title="Actions disponibles"
          accentColor="blue"
        >
          <p className="mb-3 text-sm">
            Vous pouvez réaliser ou compléter l'inspection (IPM1, IPM2, certificats sanitaires).
          </p>
          <Button
            linkProps={{
              to: sviInspectionPath,
              onClick: onAfterNavigate,
            }}
            priority="primary"
          >
            Ouvrir l'inspection complète
          </Button>
        </ModalCard>
      )}

      <ModalCard
        title="Inspection Post-Mortem 1 (IPM1)"
        accentColor={sviAccent}
      >
        {ipm1Lines.length === 0 ? (
          <p>Aucune inspection IPM1 enregistrée.</p>
        ) : (
          <div className="space-y-1 text-sm">
            {ipm1Lines.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        )}
      </ModalCard>

      <ModalCard
        title="Inspection Post-Mortem 2 (IPM2)"
        accentColor={sviAccent}
      >
        {ipm2Lines.length === 0 ? (
          <p>Aucune inspection IPM2 enregistrée.</p>
        ) : (
          <div className="space-y-1 text-sm">
            {ipm2Lines.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        )}
      </ModalCard>
    </div>
  );
}
