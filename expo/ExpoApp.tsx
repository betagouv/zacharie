import { StyleSheet, Platform, BackHandler, Linking, Modal, View, TouchableOpacity, Text } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { registerForPushNotificationsAsync } from "./services/expo-push-notifs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
const APP_URL = __DEV__ ? process.env.EXPO_PUBLIC_APP_URL : "https://zacharie.beta.gouv.fr/";
// const APP_URL = "https://zacharie.beta.gouv.fr/";
// EXPO_PUBLIC_APP_URL should be set in .env and should be like http://x.x.x.x:3234/ - get the IP with `ipconfig getifaddr en0` on macos for example

SplashScreen.preventAutoHideAsync();

const initScript = `window.ENV = {};window.ENV.APP_PLATFORM = "native";true`;
function App() {
  const ref = useRef<WebView>(null);
  const [externalLink, setExternalLink] = useState<string | null>(null);

  const onLoadEnd = () => {
    ref.current?.injectJavaScript(`if (window.ENV) { window.ENV.PLATFORM_OS = "${Platform.OS}"; }true`);
    setTimeout(() => {
      SplashScreen.hideAsync();
      Notifications.getLastNotificationResponseAsync()
        .then((response) => {
          console.log("getLastNotificationResponseAsync", response);
          if (response) {
            ref.current?.injectJavaScript(`window.onNotificationResponseReceived('${JSON.stringify(response)}');`);
            Notifications.clearLastNotificationResponseAsync();
          }
        })
        .catch((error) => {
          console.log("getLastNotificationResponseAsync error", error);
        });
      Notifications.setBadgeCountAsync(0);
    }, 2000);
  };

  const onPushNotification = (event: WebViewMessageEvent) => {
    const requestPush = event.nativeEvent.data === "request-native-push-permission";
    const requestExpoPush = event.nativeEvent.data === "request-native-expo-push-permission";
    // const readToken = event.nativeEvent.data === "request-native-get-token-if-exists";
    const readExpoToken = event.nativeEvent.data === "request-native-get-expo-token";
    registerForPushNotificationsAsync({
      force: requestPush || requestExpoPush,
      expo: readExpoToken || requestExpoPush,
    }).then((token) => {
      console.log("onPushNotification", token);
      if (!token) {
        return;
      }
      ref.current?.injectJavaScript(`window.onNativePushToken('${JSON.stringify(token)}');`);
    });
  };

  const source = useMemo(
    () => ({
      uri: `${APP_URL}app/connexion?type=compte-existant`,
    }),
    [APP_URL]
  );

  const onAndroidBackPress = () => {
    if (ref.current) {
      ref.current.goBack();
      return true; // prevent default behavior (exit app)
    }
    return false;
  };

  useEffect(() => {
    if (Platform.OS === "android") {
      BackHandler.addEventListener("hardwareBackPress", onAndroidBackPress);
    }
  }, []);

  useEffect(() => {
    AsyncStorage.getItem("@numberOfOpenings").then((numberOfOpenings) => {
      AsyncStorage.setItem("@numberOfOpenings", `${(Number(numberOfOpenings) ?? 0) + 1}`);
    });
  }, []);

  const insets = useSafeAreaInsets();

  const onMessage = useCallback(
    (event: WebViewMessageEvent) => {
      console.log("onMessage", event.nativeEvent.data);
      if (event.nativeEvent.data.includes("open-external-link")) {
        const { url } = JSON.parse(event.nativeEvent.data);
        setExternalLink(url);
        return;
      }
      switch (event.nativeEvent.data) {
        case "request-native-get-inset-bottom-height":
          ref.current?.injectJavaScript(`window.onGetInsetBottomHeight('${insets.bottom}');`);
          break;
        case "request-native-push-permission":
        case "request-native-expo-push-permission":
        case "request-native-get-token-if-exists":
        case "request-native-get-expo-token":
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
      console.log("responseListener", response);
      setTimeout(() => {
        ref.current?.injectJavaScript(`window.onNotificationResponseReceived('${JSON.stringify(response)}');`);
      }, 1500);
    });

    return () => {
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  useEffect(() => {
    setTimeout(() => {
      console.log("Constants.expoConfig?.version", Constants.expoConfig?.version);
      ref.current?.injectJavaScript(`window.onAppVersion('${JSON.stringify(Constants.expoConfig?.version)}');`);
    }, 3000);
  }, []);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeContainer} edges={["left", "right", "top", "bottom"]}>
        <WebView
          ref={ref}
          style={styles.container}
          startInLoadingState
          onLoadEnd={onLoadEnd}
          source={source}
          pullToRefreshEnabled
          allowsBackForwardNavigationGestures
          onContentProcessDidTerminate={() => ref.current?.reload()}
          // onNavigationStateChange={onNavigationStateChange}
          onMessage={onMessage}
          sharedCookiesEnabled={__DEV__}
          thirdPartyCookiesEnabled={__DEV__}
          domStorageEnabled
          javaScriptEnabled
          injectedJavaScript={initScript}
        />
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
            <WebView source={{ uri: externalLink ?? "" }} style={styles.safeContainer} />
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

export default function () {
  return (
    <SafeAreaProvider>
      <App />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: "#fff",
  },
  container: {
    flex: 1,
  },
  closeButton: {
    padding: 8,
    backgroundColor: "#000091",
    borderRadius: 8,
  },
  closeButtonText: {
    color: "#fff",
  },
  modalContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    padding: 8,
  },
});
