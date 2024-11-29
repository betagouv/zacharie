import type { FeisResponse, FeisDoneResponse } from '@api/src/types/responses';
import type { FeiWithIntermediaires } from '@api/src/types/fei';
import useZustandStore from '@app/zustand/store';
import { loadFei } from '@app/utils/load-fei';
import dayjs from 'dayjs';

export async function loadFeis() {
  const isOnline = useZustandStore.getState().isOnline;
  if (!isOnline) {
    console.log('not loading feis because not online');
    return;
  }
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/fei`, {
      method: 'GET',
      credentials: 'include',
      headers: new Headers({
        Accept: 'application/json',
        'Content-Type': 'application/json',
      }),
    })
      .then((res) => res.json())
      .then((res) => res as FeisResponse);

    if (!response.ok) {
      return;
    }

    // await new Promise((resolve) => setTimeout(resolve, 3000));

    const allFeis: Record<FeiWithIntermediaires['numero'], FeiWithIntermediaires> =
      useZustandStore.getState().feis;
    for (const fei of [
      ...response.data.feisOngoing,
      ...response.data.feisToTake,
      ...response.data.feisUnderMyResponsability,
    ]) {
      const localFei = useZustandStore.getState().feis[fei.numero];
      if (!localFei) {
        allFeis[fei.numero] = fei;
        continue;
      }
      const newestFei = dayjs(localFei.updated_at).diff(fei.updated_at) > 0 ? localFei : fei;
      const oldestFei = dayjs(localFei.updated_at).diff(fei.updated_at) > 0 ? fei : localFei;

      allFeis[fei.numero] = {
        ...oldestFei,
        ...newestFei,
      };
    }

    useZustandStore.setState({ feis: allFeis });

    for (const fei of Object.values(allFeis)) {
      await new Promise((resolve) => setTimeout(resolve, 100)); // to avoid block main thread
      loadFei(fei.numero);
    }

    const responseDone = await fetch(`${import.meta.env.VITE_API_URL}/fei/done`, {
      method: 'GET',
      credentials: 'include',
      headers: new Headers({
        Accept: 'application/json',
        'Content-Type': 'application/json',
      }),
    })
      .then((res) => res.json())
      .then((res) => res as FeisDoneResponse);

    if (!response.ok) {
      return;
    }

    useZustandStore.setState({
      feisDone: responseDone.data.feisDone,
    });

    console.log('chargement feis fini');
  } catch (error) {
    console.error('Error fetching data:', error);
    // If fetch fails (e.g., offline), the service worker will handle serving cached data
    return null;
  }
}
