import { Carcasse } from '@prisma/client';

export function formatCarcasseEmail(carcasse: Carcasse) {
  console.log('carcasse.svi_carcasse_saisie', carcasse.svi_carcasse_saisie);
  if (carcasse.svi_carcasse_saisie?.length) {
    const email = [
      `Carcasse de ${carcasse.espece}`,
      `Nombre d'animaux\u00A0: ${carcasse.nombre_d_animaux || 1}`,
      `Numéro d'identification\u00A0: ${carcasse.numero_bracelet}`,
      `Décision de saisie\u00A0: ${carcasse.svi_carcasse_saisie.join(' - ')}`,
      `Motifs de saisie\u00A0:\n${carcasse.svi_carcasse_saisie_motif
        .map((motif) => ` -> ${motif}`)
        .join('\n')}`,
      carcasse.svi_carcasse_commentaire ? `Commentaire\u00A0:\n${carcasse.svi_carcasse_commentaire}` : null,
      `Rendez-vous sur Zacharie pour consulter le détail de la carcasse : https://zacharie.beta.gouv.fr/app/tableau-de-bord/carcasse-svi/${carcasse.fei_numero}/${carcasse.zacharie_carcasse_id}`,
    ];
    return email.filter(Boolean).join('\n');
  }
  if (carcasse.intermediaire_carcasse_manquante) {
    const email = [
      `Carcasse de ${carcasse.espece} : Manquante`,
      `Nombre d'animaux\u00A0: ${carcasse.nombre_d_animaux || 1}`,
      `Numéro d'identification\u00A0: ${carcasse.numero_bracelet}`,
      carcasse.intermediaire_carcasse_commentaire
        ? `Commentaire\u00A0:\n${carcasse.intermediaire_carcasse_commentaire}`
        : null,
      `Rendez-vous sur Zacharie pour consulter le détail de la fiche : https://zacharie.beta.gouv.fr/app/tableau-de-bord/${carcasse.fei_numero}`,
    ];
    return email.filter(Boolean).join('\n');
  }

  if (carcasse.intermediaire_carcasse_refus_intermediaire_id) {
    const email = [
      `Carcasse de ${carcasse.espece}`,
      `Nombre d'animaux\u00A0: ${carcasse.nombre_d_animaux || 1}`,
      `Numéro d'identification\u00A0: ${carcasse.numero_bracelet}`,
      `Motif de refus\u00A0: ${carcasse.intermediaire_carcasse_refus_motif}`,
      carcasse.svi_carcasse_commentaire ? `Commentaire\u00A0:\n${carcasse.svi_carcasse_commentaire}` : null,
      `Rendez-vous sur Zacharie pour consulter le détail de la fiche : https://zacharie.beta.gouv.fr/app/tableau-de-bord/${carcasse.fei_numero}`,
    ].filter(Boolean);
    return email.filter(Boolean).join('\n');
  }

  const email = [
    `Carcasse de ${carcasse.espece}`,
    `Nombre d'animaux\u00A0: ${carcasse.nombre_d_animaux || 1}`,
    `Numéro d'identification\u00A0: ${carcasse.numero_bracelet}`,
    `Acceptée par le Service Vétérinaire`,
    carcasse.svi_carcasse_commentaire ? `Commentaire\u00A0:\n${carcasse.svi_carcasse_commentaire}` : null,
  ];
  return email.filter(Boolean).join('\n');
}
