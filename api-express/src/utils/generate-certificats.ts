import {
  Carcasse,
  CarcasseCertificatType,
  Entity,
  EntityTypes,
  IPM1Decision,
  IPM2Decision,
} from '@prisma/client';
import dayjs from 'dayjs';
import prisma from '~/prisma';
import { CertificatResponse } from '~/types/responses';

function checkDatesAreEqual(oldDate: Date, newDate: Date) {
  if (!oldDate) {
    if (!newDate) {
      return true;
    }
    return false;
  }
  if (!newDate) {
    return false;
  }
  return dayjs(oldDate).toISOString() === dayjs(newDate).toISOString();
}

export function checkGenerateCertificat(oldCarcasse: Carcasse, newCarcasse: Carcasse) {
  console.log('checkGenerateCertificat', oldCarcasse.svi_ipm1_signed_at, newCarcasse.svi_ipm1_signed_at);
  if (!checkDatesAreEqual(oldCarcasse.svi_ipm1_signed_at, newCarcasse.svi_ipm1_signed_at)) {
    console.log('newCarcasse.svi_ipm1_decision', newCarcasse.svi_ipm1_decision);
    if (newCarcasse.svi_ipm1_decision === IPM1Decision.MISE_EN_CONSIGNE) {
      generateDBCertificat(CarcasseCertificatType.CC, newCarcasse.zacharie_carcasse_id);
    }
  } else if (!checkDatesAreEqual(oldCarcasse.svi_ipm2_signed_at, newCarcasse.svi_ipm2_signed_at)) {
    console.log('newCarcasse.svi_ipm2_decision', newCarcasse.svi_ipm2_decision);
    if (newCarcasse.svi_ipm2_decision === IPM2Decision.SAISIE_PARTIELLE) {
      generateDBCertificat(CarcasseCertificatType.CSP, newCarcasse.zacharie_carcasse_id);
    } else if (newCarcasse.svi_ipm2_decision === IPM2Decision.SAISIE_TOTALE) {
      generateDBCertificat(CarcasseCertificatType.CST, newCarcasse.zacharie_carcasse_id);
    } else if (newCarcasse.svi_ipm2_decision === IPM2Decision.TRAITEMENT_ASSAINISSANT) {
      generateDBCertificat(CarcasseCertificatType.LPS, newCarcasse.zacharie_carcasse_id);
    } else if (newCarcasse.svi_ipm2_decision === IPM2Decision.LEVEE_DE_LA_CONSIGNE) {
      generateDBCertificat(CarcasseCertificatType.LC, newCarcasse.zacharie_carcasse_id);
    }
  }
}

export async function generateCertficatId(entity: Entity, type: CarcasseCertificatType) {
  const year = dayjs().format('YYYY');
  const inc = (entity.inc_certificat ?? 0) + 1;
  const code = entity.code_etbt_certificat;
  const id = `${code}-${type}-${year}-${inc.toString().padStart(4, '0')}`;
  await prisma.entity.update({
    where: { id: entity.id },
    data: { inc_certificat: inc },
  });
  return id;
}

export async function generateDecisionId(entity: Entity) {
  const year = dayjs().format('YYYY');
  const inc = (entity.inc_decision ?? 0) + 1;
  const code = entity.code_etbt_certificat;
  const id = `${code}-${year}-${inc.toString().padStart(4, '0')}`;
  await prisma.entity.update({
    where: { id: entity.id },
    data: { inc_decision: inc },
  });
  return id;
}

export async function generateDBCertificat(
  certificatType: CarcasseCertificatType,
  zacharie_carcasse_id: Carcasse['zacharie_carcasse_id'],
): Promise<CertificatResponse> {
  if (!zacharie_carcasse_id) {
    return {
      ok: false,
      data: { certificat: null },
      error: 'Le numéro de la carcasse est obligatoire',
    };
  }
  let existingCarcasse = await prisma.carcasse.findFirst({
    where: {
      zacharie_carcasse_id: zacharie_carcasse_id,
    },
    include: {
      Fei: {
        include: {
          FeiExaminateurInitialUser: true,
          FeiIntermediaires: {
            select: {
              FeiIntermediaireEntity: true,
            },
          },
        },
      },
    },
  });
  if (!existingCarcasse) {
    return {
      ok: false,
      data: { certificat: null },
      error: 'Carcasse non trouvée',
    };
  }

  if (certificatType === CarcasseCertificatType.CC) {
    if (
      !existingCarcasse.svi_ipm1_signed_at ||
      existingCarcasse.svi_ipm1_decision !== IPM1Decision.MISE_EN_CONSIGNE
    ) {
      return {
        ok: false,
        data: { certificat: null },
        error: "La carcasse n'a pas été mise en consigne",
      };
    }
  }

  const afterConsigne =
    certificatType === CarcasseCertificatType.CSP ||
    certificatType === CarcasseCertificatType.CST ||
    certificatType === CarcasseCertificatType.LPS ||
    certificatType === CarcasseCertificatType.LC;

  let numero_decision_ipm1;
  if (afterConsigne) {
    const consigneCertificat = await prisma.carcasseCertificat.findFirst({
      where: {
        zacharie_carcasse_id: existingCarcasse.zacharie_carcasse_id,
        type: certificatType,
        svi_ipm1_signed_at: existingCarcasse.svi_ipm1_signed_at,
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    numero_decision_ipm1 = consigneCertificat?.numero_decision;
  }

  let certificat = await prisma.carcasseCertificat.findFirst({
    where: {
      zacharie_carcasse_id: existingCarcasse.zacharie_carcasse_id,
      ...(afterConsigne
        ? {
            svi_ipm2_signed_at: existingCarcasse.svi_ipm2_signed_at,
          }
        : {
            type: certificatType,
            svi_ipm1_signed_at: existingCarcasse.svi_ipm1_signed_at,
          }),
    },
    orderBy: {
      created_at: 'desc',
    },
  });

  const fei = existingCarcasse.Fei;
  const examinateur = fei.FeiExaminateurInitialUser;
  const etg = fei.FeiIntermediaires.find(
    (intermediaire) => intermediaire.FeiIntermediaireEntity.type === EntityTypes.ETG,
  )?.FeiIntermediaireEntity!;

  if (!certificat) {
    const lastCertificat = await prisma.carcasseCertificat.findFirst({
      where: {
        zacharie_carcasse_id: existingCarcasse.zacharie_carcasse_id,
        ...(afterConsigne
          ? {
              type: { not: CarcasseCertificatType.CC },
            }
          : {
              type: certificatType,
            }),
      },
      orderBy: {
        created_at: 'desc',
      },
    });
    const newCertificatId = await generateCertficatId(etg, CarcasseCertificatType.CC);
    certificat = await prisma.carcasseCertificat.create({
      data: {
        certificat_id: newCertificatId,
        zacharie_carcasse_id: existingCarcasse.zacharie_carcasse_id,
        remplace_certificat_id: lastCertificat?.certificat_id,
        numero_decision: lastCertificat ? lastCertificat?.numero_decision : await generateDecisionId(etg),
        numero_decision_ipm1,
        type: certificatType,
        prefecture_svi: etg.prefecture_svi,
        commune_etg: etg.ville,
        date_consigne: dayjs(existingCarcasse.svi_ipm1_date!).format('DD/MM/YYYY'),
        lieu_consigne: `${etg.nom_d_usage} sis ${etg.address_ligne_1} ${etg.address_ligne_2} ${etg.code_postal} ${etg.ville}`,
        nom_etg_personne_physique: etg.nom_prenom_responsable,
        nom_etg_personne_morale: etg.raison_sociale,
        fei_numero: existingCarcasse.fei_numero,
        numero_bracelet: existingCarcasse.numero_bracelet,
        espece: existingCarcasse.espece,
        nombre_d_animaux: existingCarcasse.nombre_d_animaux,
        date_mise_a_mort: dayjs(fei.date_mise_a_mort).format('DD/MM/YYYY'),
        commune_mise_a_mort: fei.commune_mise_a_mort,
        examinateur_initial: `${examinateur?.prenom} ${examinateur?.nom_de_famille}`,
        premier_detenteur: fei.premier_detenteur_name_cache,
        collecteur_pro: fei.FeiIntermediaires.filter(
          (intermediaire) => intermediaire.FeiIntermediaireEntity.type === EntityTypes.COLLECTEUR_PRO,
        )
          .map((intermediaire) => intermediaire.FeiIntermediaireEntity.nom_d_usage)
          .join(', '),
        pieces:
          certificatType === CarcasseCertificatType.CC
            ? existingCarcasse.svi_ipm1_pieces
            : existingCarcasse.svi_ipm2_pieces,
        motifs:
          certificatType === CarcasseCertificatType.CC
            ? existingCarcasse.svi_ipm1_lesions_ou_motifs
            : existingCarcasse.svi_ipm2_lesions_ou_motifs,
        commentaire:
          certificatType === CarcasseCertificatType.CC
            ? existingCarcasse.svi_ipm1_commentaire
            : existingCarcasse.svi_ipm2_commentaire,
        poids:
          certificatType === CarcasseCertificatType.CC
            ? existingCarcasse.svi_ipm1_poids_consigne
            : existingCarcasse.svi_ipm2_poids_saisie,
        duree_consigne:
          certificatType === CarcasseCertificatType.CC ? existingCarcasse.svi_ipm1_duree_consigne : null,
        svi_ipm1_signed_at: existingCarcasse.svi_ipm1_signed_at,
        svi_ipm2_signed_at: existingCarcasse.svi_ipm2_signed_at,
        carcasse_type: existingCarcasse.type,
      },
    });
  }

  return {
    ok: true,
    data: { certificat },
    error: '',
  };
}
