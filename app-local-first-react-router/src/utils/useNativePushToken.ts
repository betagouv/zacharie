import { useCallback, useEffect, useState } from 'react';
import { UserConnexionResponse } from '@api/src/types/responses';
import useUser from '@app/zustand/user';
import API from '@app/services/api';

// La WebView Expo (expo/ExpoApp.tsx) injecte l'objet token entier sérialisé :
// `{"type":"expo","data":"ExponentPushToken[…]"}`. L'API push d'Expo n'accepte que la
// valeur du token, c'est donc la seule chose qu'on stocke.
function readTokenValue(payload: string): string | null {
  try {
    return (JSON.parse(payload) as { type: string; data: string }).data || null;
  } catch {
    return null;
  }
}

// `ask-permission` déclenche la demande de permission système (tableau de bord, case à cocher),
// `read-existing` se contente de relire le token quand la permission est déjà accordée.
type NativePushMode = 'ask-permission' | 'read-existing';

export function useNativePushToken(mode: NativePushMode) {
  const user = useUser((state) => state.user)!;
  const [deviceToken, setDeviceToken] = useState<string | null>(null);

  useEffect(() => {
    // `window.onNativePushToken` est un global unique, écrasé par la dernière page montée :
    // toutes les pages doivent donc y installer cette même implémentation.
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
        body: { native_push_token: token },
      }).then((response) => response as UserConnexionResponse);
      if (response.ok && response.data?.user?.id) {
        useUser.setState({ user: response.data.user });
      }
    };
  }, [user.id, user.native_push_tokens]);

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
    // Utilisateur déjà activé : soit on récupère simplement le token le plus récent, soit c'est un
    // utilisateur web qui vient d'installer l'app et il faut lui demander la permission.
    if (!user.activated_at) {
      return;
    }
    const timeoutId = setTimeout(askPermission, 1000);
    return () => clearTimeout(timeoutId);
  }, [mode, user.activated_at, askPermission]);

  return {
    isRegistered: !!deviceToken && user.native_push_tokens.includes(deviceToken),
    askPermission,
  };
}
