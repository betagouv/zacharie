import type { FeiByNumero } from "~/db/fei.server";
import type { Fei } from "@prisma/client";
import type { FeisLoaderData } from "~/routes/api.loader.fei";
import { getCacheItem, setCacheItem } from "~/services/indexed-db.client";

export type CachedFeis = Record<Fei["numero"], FeiByNumero>;

export async function setFeiToCache(fei: Fei) {
  const feis = (await getCacheItem("feis")) as CachedFeis | undefined;
  if (feis) {
    await setCacheItem("feis", { ...feis, [fei.numero]: fei });
    return;
  }
  const initialFeis = { [fei.numero]: fei };
  await setCacheItem("feis", initialFeis);
  return;
}

export async function setFeisToCache(lastestServerData: FeisLoaderData) {
  const latestFeis: CachedFeis = {};
  const { feisUnderMyResponsability, feisToTake, feisOngoing } = lastestServerData;
  for (const fei of feisUnderMyResponsability) {
    latestFeis[fei.numero] = fei;
  }
  for (const fei of feisToTake) {
    latestFeis[fei.numero] = fei;
  }
  for (const fei of feisOngoing) {
    latestFeis[fei.numero] = fei;
  }
  const feis = (await getCacheItem("feis")) as CachedFeis | undefined;
  if (feis) {
    await setCacheItem("feis", { ...feis, ...latestFeis });
    return;
  }
  await setCacheItem("feis", latestFeis);
  return;
}
