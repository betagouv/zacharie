import type { FeisResponse, FeisDoneResponse } from '@api/src/types/responses';
import type { FeiDone, FeiWithIntermediaires } from '@api/src/types/fei';
import useZustandStore from '@app/zustand/store';
import { loadFei } from '@app/utils/load-fei';
import dayjs from 'dayjs';
import API from '@app/services/api';

export async function loadFeis() {
  const isOnline = useZustandStore.getState().isOnline;
  if (!isOnline) {
    console.log('not loading feis because not online');
    return;
  }

  useZustandStore.setState({ dataIsSynced: false });

  try {
    const responseDone = await API.get({ path: 'fei/done' }).then((res) => res as FeisDoneResponse);

    if (!responseDone.ok) {
      return;
    }

    const feisDone = responseDone.data.feisDone.reduce(
      (acc, fei) => {
        acc[fei.numero] = fei;
        return acc;
      },
      {} as Record<FeiDone['numero'], FeiDone>,
    );

    useZustandStore.setState({
      feisDone,
      feisDoneNumeros: Object.keys(feisDone),
    });

    const response = await API.get({ path: 'fei' }).then((res) => res as FeisResponse);

    if (!response.ok) {
      return;
    }

    // await new Promise((resolve) => setTimeout(resolve, 3000));

    const allFeis: Record<FeiWithIntermediaires['numero'], FeiWithIntermediaires> = {};
    const feisNumerosToLoadAgain: Array<FeiWithIntermediaires['numero']> = [];

    for (const fei of [
      ...response.data.feisOngoing,
      ...response.data.feisToTake,
      ...response.data.feisUnderMyResponsability,
      ...responseDone.data.feisDone,
    ]) {
      const localFei = useZustandStore.getState().feis[fei.numero];
      if (!localFei && !fei.deleted_at) {
        allFeis[fei.numero] = fei;
        feisNumerosToLoadAgain.push(fei.numero);
        continue;
      }
      // optimize loading the feis
      if (fei.deleted_at || localFei.deleted_at) {
        delete allFeis[fei.numero];
        continue;
      }

      if (dayjs(localFei.updated_at).diff(fei.updated_at) > 0) {
        feisNumerosToLoadAgain.push(fei.numero);
      }

      const newestFei = dayjs(localFei.updated_at).diff(fei.updated_at) > 0 ? localFei : fei;
      const oldestFei = dayjs(localFei.updated_at).diff(fei.updated_at) > 0 ? fei : localFei;

      allFeis[fei.numero] = {
        ...oldestFei,
        ...newestFei,
      };
    }

    useZustandStore.setState({ feis: allFeis });

    for (const fei_numero of feisNumerosToLoadAgain) {
      await loadFei(fei_numero);
    }
    if (import.meta.env.VITE_TEST_PLAYWRIGHT === 'true') {
      // if it goes too fast, we have a race condition with the sync with the backend and PG doesn'tlike it
      // again, "cache lookup failed for type" problem
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    useZustandStore.setState({ dataIsSynced: true });

    console.log('chargement feis fini');
  } catch (error) {
    console.error('Error fetching data:', error);
    // If fetch fails (e.g., offline), the service worker will handle serving cached data
    return null;
  }
}
