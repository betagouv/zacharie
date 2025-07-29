import type { User } from '@prisma/client';
import * as Sentry from '@sentry/react';
import useUser from '@app/zustand/user';
import useZustandStore from '@app/zustand/store';
import API from '@app/services/api';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useMostFreshUser(_calledFrom: string) {
  // console.log('useMostFreshUser called from', calledFrom);
  const cachedUser = useUser((state) => state.user);
  if (!window.navigator.onLine) {
    if (cachedUser) {
      Sentry.setUser({
        email: cachedUser.email!,
        id: cachedUser.id,
      });
    }
    return cachedUser;
  }
  return cachedUser;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function refreshUser(_calledFrom: string) {
  if (!navigator.onLine) {
    // we need this because if offLine then the service worker return the latest GET /user/me
    // and it makes the prochain_bracelet_a_utiliser stale
    return null;
  }
  const controller = new AbortController();
  const { signal } = controller;

  try {
    const timeout = new Promise<null>((_, reject) =>
      setTimeout(() => {
        controller.abort(); // Abort the fetch when the timeout occurs
        reject(new Error('Timeout'));
      }, 5000),
    );

    const fetchPromise = API.get({
      path: 'user/me',
      signal, // Pass the signal to the fetch request
    }).then(async (userResponse) => {
      // Good connection event only dispatched if no timeout
      window.dispatchEvent(new Event('good-connection'));
      if (userResponse.status === 401) {
        useUser.setState({ user: null });
        Sentry.setUser({});
        return null;
      }

      if (userResponse?.ok && userResponse.data?.user) {
        const user = userResponse.data.user as User;
        useUser.setState({ user });
        useZustandStore.setState((state) => ({
          users: {
            ...state.users,
            [user.id]: user,
          },
        }));
        Sentry.setUser({ email: user.email!, id: user.id });

        return user;
      }

      return null;
    });

    return await Promise.race([timeout, fetchPromise]);
  } catch (error) {
    if (error instanceof Error && error.message === 'Timeout') {
      // Timeout specific handling
      window.dispatchEvent(new Event('very-bad-connection'));
    } else if (error instanceof Error && error.name === 'AbortError') {
      console.warn('Fetch aborted due to timeout.');
    } else {
      console.error('Failed to refresh user:', error);
    }
    return null;
  }
}
