import type { FeiByNumero } from "~/db/fei.server";
import type { Fei } from "@prisma/client";
import { getCacheItem, setCacheItem } from "~/services/indexed-db.client";

type CachedFeis = Record<Fei["numero"], FeiByNumero>;

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