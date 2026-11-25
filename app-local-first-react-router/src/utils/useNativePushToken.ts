import { useCallback, useEffect, useState } from 'react';
import { UserNotifications } from '@prisma/client';
import { UserConnexionResponse } from '@api/src/types/responses';
import useUser from '@app/zustand/user';
import API from '@app/services/api';

function readTokenValue(payload: string): string | null {
  try {
    return (JSON.parse(payload) as { type: string; data: string }).data || null;
  } catch {
    return null;
  }
}

type NativePushMode = 'ask-permission' | 'read-existing';

export function useNativePushToken(mode: NativePushMode) {
  const user = useUser((state) => state.user)!;
  const [deviceToken, setDeviceToken] = useState<string | null>(null);

  useEffect(() => {
    window.onNativePushToken = async function handleNativePushToken(payload) {
      const token = readTokenValue(payload);
      if (!token) {
        return;
      }
      setDeviceToken(token);
      if (user.native_push_tokens.includes(token)) {
        return;
      }
      const response = await API.post({
        path: `/user/${user.id}`,
        body: {
          native_push_token: token,
          notifications: [...new Set([...user.notifications, UserNotifications.PUSH])],
        },
      }).then((response) => response as UserConnexionResponse);
      if (response.ok && response.data?.user?.id) {
        useUser.setState({ user: response.data.user });
      }
    };
  }, [user.id, user.native_push_tokens, user.notifications]);

  const askPermission = useCallback(() => {
    window.ReactNativeWebView?.postMessage('request-native-expo-push-permission');
  }, []);

  useEffect(() => {
    if (!window.ReactNativeWebView) {
      return;
    }
    if (mode === 'read-existing') {
      window.ReactNativeWebView.postMessage('request-native-get-expo-token');
      return;
    }
    if (!user.activated_at) {
      return;
    }
    const timeoutId = setTimeout(askPermission, 1000);
    return () => clearTimeout(timeoutId);
  }, [mode, user.activated_at, askPermission]);

  return {
    isEnabled:
      !!deviceToken &&
      user.native_push_tokens.includes(deviceToken) &&
      user.notifications.includes(UserNotifications.PUSH),
    askPermission,
  };
}
