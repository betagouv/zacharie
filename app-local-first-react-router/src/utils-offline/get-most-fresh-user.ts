import type { User } from '@prisma/client';
import * as Sentry from '@sentry/react';
import useUser from '@app/zustand/user';
import useZustandStore from '@app/zustand/store';

export function getMostFreshUser(calledFrom: string) {
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

export async function refreshUser(calledFrom: string) {
  // console.log('refreshUser called from', calledFrom);
  return fetch(`${import.meta.env.VITE_API_URL}/user/me`, {
    method: 'GET',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
    },
  })
    .then(async (response) => {
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
        if (user) {
          Sentry.setUser({
            email: user.email!,
            id: user.id,
          });
        } else {
          Sentry.setUser({});
        }
        return user;
      }
      return null;
    })
    .catch(console.error);
}
