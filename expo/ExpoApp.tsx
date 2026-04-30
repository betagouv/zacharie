import {
  StyleSheet,
  Platform,
  BackHandler,
  Linking,
  Modal,
  View,
  TouchableOpacity,
  Text,
} from 'react-native';
import { WebView, type WebViewMessageEvent } from '@dr.pogodin/react-native-webview';
import { registerForPushNotificationsAsync } from './services/expo-push-notifs';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useFonts } from 'expo-font';
import { checkAndDownloadSpa, startSpaServer, stopSpaServer } from './utils/offline-spa';
import Chargement from './components/Chargement';

SplashScreen.preventAutoHideAsync();

const initScript = `window.ENV = {};window.ENV.APP_PLATFORM = "native";true`;
function App() {
  const ref = useRef<WebView>(null);
  const [externalLink, setExternalLink] = useState<string | null>(null);
  const [spaUrl, setSpaUrl] = useState<string | null>(null);
  const [spaReady, setSpaReady] = useState(false);
  const [fontsLoaded] = useFonts({
    'Marianne-Regular': require('./assets/marianne/Marianne-Regular.ttf'),
    'Marianne-Medium': require('./assets/marianne/Marianne-Medium.ttf'),
    'Marianne-Bold': require('./assets/marianne/Marianne-Bold.ttf'),
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Hand off the native splash to <Chargement /> only once Marianne is
    // available, otherwise the loader briefly renders with the system font.
    if (fontsLoaded) {
      setTimeout(() => {
        SplashScreen.hideAsync();
      }, 500);
    }
  }, [fontsLoaded]);

  useEffect(() => {
    AsyncStorage.getItem('initial-path').then((initialPath = '/') => {
      checkAndDownloadSpa().then(() => {
        startSpaServer().then((url) => {
          if (url) {
            if (initialPath) url += initialPath;
            console.log('url: ', url);
            setSpaUrl(url);
          }
          setSpaReady(true);
          setTimeout(() => {
            setLoading(false);
          }, 1500);
        });
      });
      return () => {
        stopSpaServer();
      };
    });
  }, []);

  const onLoadEnd = () => {
    ref.current?.injectJavaScript(`if (window.ENV) { window.ENV.PLATFORM_OS = "${Platform.OS}"; }true`);
    setTimeout(() => {
      SplashScreen.hideAsync();
      Notifications.getLastNotificationResponseAsync()
        .then((response) => {
          console.log('getLastNotificationResponseAsync', response);
          if (response) {
            // ref.current?.injectJavaScript(`window.onNotificationResponseReceived('${JSON.stringify(response)}');`);
            Notifications.clearLastNotificationResponseAsync();
          }
        })
        .catch((error) => {
          console.log('getLastNotificationResponseAsync error', error);
        });
      Notifications.setBadgeCountAsync(0);
    }, 2000);
  };

  const onPushNotification = (event: WebViewMessageEvent) => {
    const requestPush = event.nativeEvent.data === 'request-native-push-permission';
    const requestExpoPush = event.nativeEvent.data === 'request-native-expo-push-permission';
    // const readToken = event.nativeEvent.data === "request-native-get-token-if-exists";
    const readExpoToken = event.nativeEvent.data === 'request-native-get-expo-token';
    registerForPushNotificationsAsync({
      force: requestPush || requestExpoPush,
      expo: readExpoToken || requestExpoPush,
    }).then((token) => {
      console.log('onPushNotification', token);
      if (!token) {
        return;
      }
      ref.current?.injectJavaScript(`window.onNativePushToken('${JSON.stringify(token)}');true`);
    });
  };

  const onAndroidBackPress = () => {
    if (ref.current) {
      ref.current.goBack();
      return true; // prevent default behavior (exit app)
    }
    return false;
  };

  useEffect(() => {
    if (Platform.OS === 'android') {
      BackHandler.addEventListener('hardwareBackPress', onAndroidBackPress);
    }
  }, []);

  useEffect(() => {
    AsyncStorage.getItem('@numberOfOpenings').then((numberOfOpenings) => {
      AsyncStorage.setItem('@numberOfOpenings', `${(Number(numberOfOpenings) ?? 0) + 1}`);
    });
  }, []);

  const insets = useSafeAreaInsets();

  const onMessage = useCallback(
    (event: WebViewMessageEvent) => {
      console.log('onMessage', event.nativeEvent.data);
      if (event.nativeEvent.data.includes('open-external-link')) {
        const { url } = JSON.parse(event.nativeEvent.data);
        setExternalLink(url);
        return;
      }
      if (event.nativeEvent.data.includes('save-initial-path')) {
        const { initialPath } = JSON.parse(event.nativeEvent.data);
        AsyncStorage.setItem('initial-path', initialPath);
        return;
      }
      switch (event.nativeEvent.data) {
        case 'request-native-push-permission':
        case 'request-native-expo-push-permission':
        case 'request-native-get-token-if-exists':
        case 'request-native-get-expo-token':
          onPushNotification(event);
          break;
        default:
          break;
      }
    },
    [onPushNotification, insets]
  );

  const responseListener = useRef<Notifications.EventSubscription>(null);
  useEffect(() => {
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('responseListener', response);
      setTimeout(() => {
        // ref.current?.injectJavaScript(`window.onNotificationResponseReceived('${JSON.stringify(response)}');`);
      }, 1500);
    });

    return () => {
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <>
      <SafeAreaView style={styles.safeContainer} edges={['left', 'right', 'top', 'bottom']}>
        {spaReady && spaUrl ? (
          <WebView
            ref={ref}
            style={styles.container}
            startInLoadingState
            onLoadEnd={onLoadEnd}
            onError={(error: any) => console.log('onError', error)}
            source={{ uri: spaUrl }}
            originWhitelist={['*']}
            pullToRefreshEnabled
            allowsBackForwardNavigationGestures
            onContentProcessDidTerminate={() => ref.current?.reload()}
            onMessage={onMessage}
            onShouldStartLoadWithRequest={(request: any) => {
              const stayInWebView = request.url.startsWith(spaUrl);
              if (!stayInWebView) {
                Linking.openURL(request.url);
              }
              return stayInWebView;
            }}
            sharedCookiesEnabled={true}
            thirdPartyCookiesEnabled={true}
            domStorageEnabled
            javaScriptEnabled
            webviewDebuggingEnabled={__DEV__}
            injectedJavaScript={initScript}
          />
        ) : spaReady ? (
          <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
            <Text>Pas de cache disponible. Connectez-vous à internet pour télécharger l'application.</Text>
          </View>
        ) : null}
        <Modal
          visible={!!externalLink}
          onRequestClose={() => setExternalLink(null)}
          animationType="slide"
          presentationStyle="formSheet"
        >
          <SafeAreaView style={styles.safeContainer}>
            <View style={styles.modalContainer}>
              <TouchableOpacity onPress={() => setExternalLink(null)} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>Fermer</Text>
              </TouchableOpacity>
            </View>
            <WebView source={{ uri: externalLink ?? '' }} style={styles.container} />
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
      {loading && (
        <SafeAreaView style={styles.safeContainerAbsolute} edges={['left', 'right', 'top', 'bottom']}>
          <Chargement />
        </SafeAreaView>
      )}
    </>
  );
}

export default function AppWrapped() {
  return (
    <SafeAreaProvider>
      <App />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  safeContainerAbsolute: {
    flex: 1,
    backgroundColor: '#fff',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  container: {
    flex: 1,
  },
  containerOffline: {
    flex: 1,
    borderWidth: 5,
    borderColor: '#000091',
  },
  closeButton: {
    padding: 8,
    backgroundColor: '#000091',
    borderRadius: 8,
  },
  closeButtonText: {
    color: '#fff',
  },
  modalContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 8,
  },
});
