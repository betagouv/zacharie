import * as zodSchemas from "prisma/generated/zod";
import { Prisma, type Carcasse } from "@prisma/client";
import { SerializeFrom } from "@remix-run/node";
import dayjs from "dayjs";

export function mergeCarcasseToJSON(
  oldItem: SerializeFrom<Carcasse>,
  newItem: FormData = new FormData(),
): FormData | SerializeFrom<Carcasse> {
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

  // Explicitly handle each field, including optional ones
  const result = {
    numero_bracelet: mergedItem.numero_bracelet,
    fei_numero: mergedItem.fei_numero,
    heure_mise_a_mort: mergedItem.heure_mise_a_mort,
    heure_evisceration: mergedItem.heure_evisceration,
    espece: mergedItem.espece,
    categorie: mergedItem.categorie,
    examinateur_carcasse_sans_anomalie:
      newItem?.get("examinateur_carcasse_sans_anomalie") === "true"
        ? true
        : newItem?.get("examinateur_carcasse_sans_anomalie") === "false"
          ? false
          : mergedItem.examinateur_carcasse_sans_anomalie,
    // prettier-ignore
    examinateur_anomalies_carcasse: newItem?.getAll?.(Prisma.CarcasseScalarFieldEnum.examinateur_anomalies_carcasse)?.length
      ? newItem?.getAll(Prisma.CarcasseScalarFieldEnum.examinateur_anomalies_carcasse).map(String)
      : (oldItem.examinateur_anomalies_carcasse ?? []),
    examinateur_anomalies_abats: newItem?.getAll?.(Prisma.CarcasseScalarFieldEnum.examinateur_anomalies_abats)?.length
      ? newItem?.getAll(Prisma.CarcasseScalarFieldEnum.examinateur_anomalies_abats).map(String)
      : (oldItem.examinateur_anomalies_abats ?? []),
    examinateur_commentaire: mergedItem.examinateur_commentaire,
    examinateur_signed_at: mergedItem.examinateur_signed_at
      ? dayjs(mergedItem.examinateur_signed_at).toISOString()
      : null,
    intermediaire_carcasse_refus_intermediaire_id: mergedItem.intermediaire_carcasse_refus_intermediaire_id || null,
    intermediaire_carcasse_refus_motif: mergedItem.intermediaire_carcasse_refus_motif,
    intermediaire_carcasse_signed_at: mergedItem.intermediaire_carcasse_signed_at
      ? dayjs(mergedItem.intermediaire_carcasse_signed_at).toISOString()
      : null,
    intermediaire_carcasse_commentaire: mergedItem.intermediaire_carcasse_commentaire,
    svi_carcasse_saisie:
      newItem?.get("svi_carcasse_saisie") === "true"
        ? true
        : newItem?.get("svi_carcasse_saisie") === "false"
          ? false
          : mergedItem.svi_carcasse_saisie,
    svi_carcasse_saisie_motif: newItem?.getAll?.(Prisma.CarcasseScalarFieldEnum.svi_carcasse_saisie_motif)?.length
      ? newItem?.getAll(Prisma.CarcasseScalarFieldEnum.svi_carcasse_saisie_motif).map(String)
      : (oldItem.svi_carcasse_saisie_motif ?? []),
    svi_carcasse_saisie_at: mergedItem.svi_carcasse_saisie_at
      ? dayjs(mergedItem.svi_carcasse_saisie_at).toISOString()
      : null,
    svi_carcasse_signed_at: mergedItem.svi_carcasse_signed_at
      ? dayjs(mergedItem.svi_carcasse_signed_at).toISOString()
      : null,
    svi_carcasse_commentaire: mergedItem.svi_carcasse_commentaire,
    created_at: mergedItem.created_at,
    updated_at: dayjs().toISOString(),
    deleted_at: mergedItem.deleted_at ? dayjs(mergedItem.deleted_at).toISOString() : null,
  };

  const zodCarcasseResult = zodSchemas.CarcasseSchema.parse(result);
  console.log({ zodCarcasseResult });

  return result;
}

export function mergeCarcasse(oldItem: SerializeFrom<Carcasse>, newItem?: FormData): FormData {
  const result = mergeCarcasseToJSON(oldItem, newItem);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function getFormData(object: Record<string, any>) {
    const formData = new FormData();
    Object.keys(object).forEach((key) => formData.append(key, object[key]));
    return formData;
  }
  return getFormData(result) satisfies FormData;
}
