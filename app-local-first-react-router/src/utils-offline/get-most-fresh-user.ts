import type { User } from '@prisma/client';
import * as Sentry from '@sentry/react';
import useUser from '@app/zustand/user';
import useZustandStore from '@app/zustand/store';

export function getMostFreshUser(_calledFrom: string) {
  // console.log('getMostFreshUser called from', calledFrom);
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

export async function refreshUser(_calledFrom: string) {
  const controller = new AbortController();
  const { signal } = controller;

  try {
    const timeout = new Promise<null>((_, reject) =>
      setTimeout(() => {
        controller.abort(); // Abort the fetch when the timeout occurs
        reject(new Error('Timeout'));
      }, 5000),
    );

    const fetchPromise = fetch(`${import.meta.env.VITE_API_URL}/user/me`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
      },
      signal, // Pass the signal to the fetch request
    }).then(async (response) => {
      // Good connection event only dispatched if no timeout
      window.dispatchEvent(new Event('good-connection'));
      if (response.status === 401) {
        useUser.setState({ user: null });
        Sentry.setUser({});
        return null;
      }

      const userResponse = await response.json();
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
