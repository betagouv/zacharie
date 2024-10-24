// import * as zodSchemas from "prisma/generated/zod";
import { CarcasseType, Prisma, type Carcasse } from "@prisma/client";
import { SerializeFrom } from "@remix-run/node";
import dayjs from "dayjs";

export function mergeCarcasseToJSON(oldItem: SerializeFrom<Carcasse>, newItem?: FormData): SerializeFrom<Carcasse> {
  if (newItem) {
    for (const key of newItem?.keys() ?? []) {
      if (newItem?.get(key) === undefined) {
        newItem!.delete(key);
      }
    }
  }
  const mergedItem: SerializeFrom<Carcasse> = {
    ...oldItem,
    ...Object.fromEntries(newItem!),
  };

  let nextAnomaliesCarcasse: string[] = [];
  let nextAnomaliesAbats: string[] = [];
  if (newItem?.get(Prisma.CarcasseScalarFieldEnum.examinateur_carcasse_sans_anomalie) === "false") {
    nextAnomaliesCarcasse = newItem?.getAll?.(Prisma.CarcasseScalarFieldEnum.examinateur_anomalies_carcasse)?.length
      ? newItem?.getAll(Prisma.CarcasseScalarFieldEnum.examinateur_anomalies_carcasse).map(String).filter(Boolean)
      : (oldItem.examinateur_anomalies_carcasse ?? []);
    nextAnomaliesAbats = newItem?.getAll?.(Prisma.CarcasseScalarFieldEnum.examinateur_anomalies_abats)?.length
      ? newItem?.getAll(Prisma.CarcasseScalarFieldEnum.examinateur_anomalies_abats).map(String).filter(Boolean)
      : (oldItem.examinateur_anomalies_abats ?? []);
  }

  // Explicitly handle each field, including optional ones
  const result = {
    numero_bracelet: mergedItem.numero_bracelet,
    fei_numero: mergedItem.fei_numero,
    type: mergedItem.type ?? CarcasseType.GROS_GIBIER,
    nombre_d_animaux: mergedItem.nombre_d_animaux || 0,
    heure_mise_a_mort: mergedItem.heure_mise_a_mort || null,
    heure_evisceration: mergedItem.heure_evisceration || null,
    espece: mergedItem.espece || null,
    categorie: mergedItem.categorie || null,
    examinateur_carcasse_sans_anomalie:
      newItem?.get(Prisma.CarcasseScalarFieldEnum.examinateur_carcasse_sans_anomalie) === "true"
        ? true
        : newItem?.get(Prisma.CarcasseScalarFieldEnum.examinateur_carcasse_sans_anomalie) === "false"
          ? false
          : mergedItem.examinateur_carcasse_sans_anomalie || null,
    intermediaire_carcasse_manquante:
      newItem?.get(Prisma.CarcasseScalarFieldEnum.intermediaire_carcasse_manquante) === "true"
        ? true
        : newItem?.get(Prisma.CarcasseScalarFieldEnum.intermediaire_carcasse_manquante) === "false"
          ? false
          : mergedItem.intermediaire_carcasse_manquante || null,
    // prettier-ignore
    examinateur_anomalies_carcasse:nextAnomaliesCarcasse,
    examinateur_anomalies_abats: nextAnomaliesAbats,
    examinateur_commentaire: mergedItem.examinateur_commentaire,
    examinateur_signed_at: mergedItem.examinateur_signed_at
      ? dayjs(mergedItem.examinateur_signed_at).toISOString()
      : null,
    intermediaire_carcasse_refus_intermediaire_id: mergedItem.intermediaire_carcasse_refus_intermediaire_id || null,
    intermediaire_carcasse_refus_motif: mergedItem.intermediaire_carcasse_refus_motif || null,
    intermediaire_carcasse_signed_at: mergedItem.intermediaire_carcasse_signed_at
      ? dayjs(mergedItem.intermediaire_carcasse_signed_at).toISOString()
      : null,
    intermediaire_carcasse_commentaire: mergedItem.intermediaire_carcasse_commentaire || null,
    svi_carcasse_saisie: newItem?.getAll?.(Prisma.CarcasseScalarFieldEnum.svi_carcasse_saisie)?.length
      ? newItem?.getAll(Prisma.CarcasseScalarFieldEnum.svi_carcasse_saisie).map(String).filter(Boolean)
      : (oldItem.svi_carcasse_saisie ?? []),
    svi_carcasse_saisie_motif: newItem?.getAll?.(Prisma.CarcasseScalarFieldEnum.svi_carcasse_saisie_motif)?.length
      ? newItem?.getAll(Prisma.CarcasseScalarFieldEnum.svi_carcasse_saisie_motif).map(String).filter(Boolean)
      : (oldItem.svi_carcasse_saisie_motif ?? []),
    svi_carcasse_saisie_at: mergedItem.svi_carcasse_saisie_at
      ? dayjs(mergedItem.svi_carcasse_saisie_at).toISOString()
      : null,
    svi_carcasse_signed_at: mergedItem.svi_carcasse_signed_at
      ? dayjs(mergedItem.svi_carcasse_signed_at).toISOString()
      : null,
    svi_carcasse_commentaire: mergedItem.svi_carcasse_commentaire || null,
    created_at: mergedItem.created_at,
    updated_at: dayjs().toISOString(),
    deleted_at: mergedItem.deleted_at ? dayjs(mergedItem.deleted_at).toISOString() : null,
  };

  // const zodCarcasseResult = zodSchemas.CarcasseSchema.parse(result);
  // console.log({ zodCarcasseResult });

  return result;
}

export function mergeCarcasse(oldItem: SerializeFrom<Carcasse>, newItem?: FormData): FormData {
  const result = mergeCarcasseToJSON(oldItem, newItem);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function getFormData(object: Record<string, any>) {
    const formData = new FormData();
    Object.keys(object).forEach((key) => {
      if (Array.isArray(object[key])) {
        object[key].forEach((value) => {
          formData.append(key, value);
        });
      } else {
        formData.append(key, object[key]);
      }
    });
    return formData;
  }
  return getFormData(result) satisfies FormData;
}
