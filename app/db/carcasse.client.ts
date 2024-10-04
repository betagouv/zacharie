import { type Fei, type Carcasse, type CarcasseIntermediaire } from "@prisma/client";
import type { FeiWithRelations } from "./fei.server";
import type { CarcasseLoaderData } from "~/routes/api.loader.carcasse.$fei_numero.$numero_bracelet";
import type { CarcasseActionData } from "~/routes/api.action.carcasse.$numero_bracelet";
import type { SuiviCarcasseActionData } from "~/routes/api.action.carcasse-suivi.$numero_bracelet.$intermediaire_id";

export function formatCarcasseOfflineActionReturn(
  carcasseFormData: FormData,
  originalCarcasse: CarcasseActionData["data"] | FeiWithRelations["Carcasses"][0] | null,
): CarcasseActionData {
  const getFormValue = (key: keyof Carcasse) => {
    const value = carcasseFormData.get(key);
    return value !== null ? value.toString() : null;
  };

  const getFormArray = (key: keyof Carcasse) => {
    return carcasseFormData.getAll(key).map(String);
  };

  return {
    ok: true,
    error: "",
    data: {
      numero_bracelet: getFormValue("numero_bracelet")!,
      fei_numero: getFormValue("fei_numero")!,
      heure_mise_a_mort: getFormValue("heure_mise_a_mort") ?? originalCarcasse?.heure_mise_a_mort ?? null,
      heure_evisceration: getFormValue("heure_evisceration") ?? originalCarcasse?.heure_evisceration ?? null,
      espece: getFormValue("espece") ?? originalCarcasse?.espece ?? null,
      categorie: getFormValue("categorie") ?? originalCarcasse?.categorie ?? null,
      examinateur_carcasse_sans_anomalie: getFormValue("examinateur_carcasse_sans_anomalie") === "true",
      examinateur_anomalies_carcasse:
        getFormArray("examinateur_anomalies_carcasse").length > 0
          ? getFormArray("examinateur_anomalies_carcasse")
          : originalCarcasse?.examinateur_anomalies_carcasse || [],
      examinateur_anomalies_abats:
        getFormArray("examinateur_anomalies_abats").length > 0
          ? getFormArray("examinateur_anomalies_abats")
          : originalCarcasse?.examinateur_anomalies_abats || [],
      examinateur_commentaire:
        getFormValue("examinateur_commentaire") ?? originalCarcasse?.examinateur_commentaire ?? null,
      examinateur_signed_at:
        (getFormValue("examinateur_signed_at") as unknown as Date) ?? originalCarcasse?.examinateur_signed_at ?? null,
      intermediaire_carcasse_refus_intermediaire_id:
        getFormValue("intermediaire_carcasse_refus_intermediaire_id") ??
        originalCarcasse?.intermediaire_carcasse_refus_intermediaire_id ??
        null,
      intermediaire_carcasse_refus_motif:
        getFormValue("intermediaire_carcasse_refus_motif") ??
        originalCarcasse?.intermediaire_carcasse_refus_motif ??
        null,
      intermediaire_carcasse_signed_at:
        (getFormValue("intermediaire_carcasse_signed_at") as unknown as Date) ??
        originalCarcasse?.intermediaire_carcasse_signed_at ??
        null,
      intermediaire_carcasse_commentaire:
        getFormValue("intermediaire_carcasse_commentaire") ??
        originalCarcasse?.intermediaire_carcasse_commentaire ??
        null,
      svi_carcasse_saisie: originalCarcasse?.svi_carcasse_saisie ?? null,
      svi_carcasse_saisie_motif: originalCarcasse?.svi_carcasse_saisie_motif || [],
      svi_carcasse_saisie_at: originalCarcasse?.svi_carcasse_saisie_at ?? null,
      svi_carcasse_signed_at: originalCarcasse?.svi_carcasse_signed_at ?? null,
      svi_carcasse_commentaire: originalCarcasse?.svi_carcasse_commentaire ?? null,
      created_at: originalCarcasse?.created_at ?? new Date(),
      updated_at: new Date(),
      deleted_at: originalCarcasse?.deleted_at ?? null,
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

export function formatSuiviCarcasseByIntermediaire(
  carcasseIntermediaire: CarcasseIntermediaire,
): SuiviCarcasseActionData {
  return {
    ok: true,
    data: {
      ...carcasseIntermediaire,
      carcasse_check_finished_at: new Date(),
    },
    error: "",
  };
}

export function insertSuiviCarcasseByIntermediaireInFei(
  carcasseIntermediaire: CarcasseIntermediaire,
  fei: FeiWithRelations,
): FeiWithRelations {
  return {
    ...fei,
    FeiIntermediaires: fei.FeiIntermediaires.map((intermediaire) => {
      if (intermediaire.id !== carcasseIntermediaire.fei_intermediaire_id) {
        return intermediaire;
      }
      const existingCarcasseIntermediaire = intermediaire.CarcasseIntermediaire.find(
        (ci) =>
          ci.fei_numero__bracelet__intermediaire_id === carcasseIntermediaire.fei_numero__bracelet__intermediaire_id,
      );
      if (existingCarcasseIntermediaire) {
        return {
          ...intermediaire,
          CarcasseIntermediaire: intermediaire.CarcasseIntermediaire.map((ci) => {
            if (
              ci.fei_numero__bracelet__intermediaire_id !== carcasseIntermediaire.fei_numero__bracelet__intermediaire_id
            ) {
              return ci;
            }
            return {
              ...ci,
              ...carcasseIntermediaire,
            };
          }),
        };
      }
      return {
        ...intermediaire,
        CarcasseIntermediaire: [...intermediaire.CarcasseIntermediaire, carcasseIntermediaire],
      };
    }),
  };
}
