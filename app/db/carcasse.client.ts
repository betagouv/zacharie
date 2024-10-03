import { type Fei, type Carcasse } from "@prisma/client";
import type { FeiWithRelations } from "./fei.server";
import type { CarcasseLoaderData } from "~/routes/api.loader.carcasse.$fei_numero.$numero_bracelet";
import type { CarcasseActionData } from "~/routes/api.action.carcasse.$numero_bracelet";

export function formatCarcasseOfflineActionReturn(
  carcasseFormData: Carcasse,
  originalCarcasse: CarcasseActionData["data"] | FeiWithRelations["Carcasses"][0] | null,
): CarcasseActionData {
  return {
    ok: true,
    error: "",
    data: {
      numero_bracelet: carcasseFormData.numero_bracelet ?? originalCarcasse?.numero_bracelet,
      fei_numero: carcasseFormData.fei_numero ?? originalCarcasse?.fei_numero,
      heure_mise_a_mort: carcasseFormData.heure_mise_a_mort ?? originalCarcasse?.heure_mise_a_mort ?? null,
      heure_evisceration: carcasseFormData.heure_evisceration ?? originalCarcasse?.heure_evisceration ?? null,
      espece: carcasseFormData.espece ?? originalCarcasse?.espece ?? null,
      categorie: carcasseFormData.categorie ?? originalCarcasse?.categorie ?? null,
      examinateur_carcasse_sans_anomalie:
        carcasseFormData.examinateur_carcasse_sans_anomalie ??
        originalCarcasse?.examinateur_carcasse_sans_anomalie ??
        null,
      examinateur_anomalies_carcasse:
        carcasseFormData.examinateur_anomalies_carcasse || originalCarcasse?.examinateur_anomalies_carcasse || [],
      examinateur_anomalies_abats:
        carcasseFormData.examinateur_anomalies_abats || originalCarcasse?.examinateur_anomalies_abats || [],
      examinateur_commentaire:
        carcasseFormData.examinateur_commentaire ?? originalCarcasse?.examinateur_commentaire ?? null,
      examinateur_refus: carcasseFormData.examinateur_refus ?? originalCarcasse?.examinateur_refus ?? null,
      examinateur_signed_at: carcasseFormData.examinateur_signed_at ?? originalCarcasse?.examinateur_signed_at ?? null,
      intermediaire_carcasse_refus_intermediaire_id:
        carcasseFormData.intermediaire_carcasse_refus_intermediaire_id ??
        originalCarcasse?.intermediaire_carcasse_refus_intermediaire_id ??
        null,
      intermediaire_carcasse_refus_motif:
        carcasseFormData.intermediaire_carcasse_refus_motif ??
        originalCarcasse?.intermediaire_carcasse_refus_motif ??
        null,
      intermediaire_carcasse_signed_at:
        carcasseFormData.intermediaire_carcasse_signed_at ?? originalCarcasse?.intermediaire_carcasse_signed_at ?? null,
      intermediaire_carcasse_commentaire:
        carcasseFormData.intermediaire_carcasse_commentaire ??
        originalCarcasse?.intermediaire_carcasse_commentaire ??
        null,
      svi_carcasse_saisie: carcasseFormData.svi_carcasse_saisie ?? originalCarcasse?.svi_carcasse_saisie ?? null,
      svi_carcasse_saisie_motif:
        carcasseFormData.svi_carcasse_saisie_motif ?? originalCarcasse?.svi_carcasse_saisie_motif,
      svi_carcasse_saisie_at:
        carcasseFormData.svi_carcasse_saisie_at ?? originalCarcasse?.svi_carcasse_saisie_at ?? null,
      svi_carcasse_signed_at:
        carcasseFormData.svi_carcasse_signed_at ?? originalCarcasse?.svi_carcasse_signed_at ?? null,
      svi_carcasse_commentaire:
        carcasseFormData.svi_carcasse_commentaire ?? originalCarcasse?.svi_carcasse_commentaire ?? null,
      created_at: carcasseFormData.created_at ?? originalCarcasse?.created_at,
      updated_at: carcasseFormData.updated_at ?? originalCarcasse?.updated_at,
      deleted_at: carcasseFormData.deleted_at ?? originalCarcasse?.deleted_at ?? null,
    },
  };
}

export function formatCarcasseOfflineLoaderReturn(carcasse: Carcasse, fei: Fei): CarcasseLoaderData {
  return {
    ok: true,
    data: {
      carcasse: {
        ...carcasse,
        Fei: fei,
      },
      fei: fei,
    },
    error: "",
  };
}
