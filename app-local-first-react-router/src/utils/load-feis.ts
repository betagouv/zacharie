import type { FeisResponse, FeiRefreshResponse } from '@api/src/types/responses';
import type { FeiWithIntermediaires } from '@api/src/types/fei';
import type { EntityWithUserRelation } from '@api/src/types/entity';
import useZustandStore from '@app/zustand/store';
import { setFeiInStore } from '@app/utils/load-fei';
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
      ...response.data.feisDone,
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

    if (feisNumerosToLoadAgain.length > 0) {
      const BATCH_SIZE = 100;
      for (let i = 0; i < feisNumerosToLoadAgain.length; i += BATCH_SIZE) {
        const batch = feisNumerosToLoadAgain.slice(i, i + BATCH_SIZE);
        const feisRefreshed = await API.post({
          path: 'fei/refresh',
          body: { numeros: batch },
        }).then((res) => res as FeiRefreshResponse);
        if (!feisRefreshed.ok) {
          alert(
            `Un problème est survenu lors du chargement de l'application: ${feisRefreshed.error}. Veuillez recharger la page. Si le problème persiste, veuillez contacter l'équipe technique.`,
          );
          return;
        }

        // Store users and entities from flat arrays
        const prevState = useZustandStore.getState();
        for (const user of feisRefreshed.data.users) {
          if (!prevState.users[user.id]) {
            prevState.users[user.id] = user;
          }
        }
        for (const entity of feisRefreshed.data.entities) {
          const existing = prevState.entities[entity.id];
          prevState.entities[entity.id] = {
            ...existing,
            ...entity,
            relation: existing?.relation ?? 'NONE',
            relationStatus: existing?.relationStatus ?? undefined,
          } satisfies EntityWithUserRelation;
        }
        useZustandStore.setState(prevState, true);

        // Process FEIs, carcasses, and intermediaires
        for (const fei of feisRefreshed.data.feis) {
          setFeiInStore(fei);
          if (import.meta.env.VITE_TEST_PLAYWRIGHT === 'true') {
            // if it goes too fast, we have a race condition with the sync with the backend and PG doesn't like it
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        }
      }
    }

    const state = useZustandStore.getState();
    useZustandStore.setState({
      feis: { ...state.feis },
      users: { ...state.users },
      entities: { ...state.entities },
      carcasses: { ...state.carcasses },
      carcassesIntermediaireById: { ...state.carcassesIntermediaireById },
      dataIsSynced: true,
    });

    console.log('chargement feis fini');
  } catch (error) {
    console.error('Error fetching data:', error);
    // If fetch fails (e.g., offline), the service worker will handle serving cached data
    return null;
  }
}
