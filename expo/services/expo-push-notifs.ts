import { Platform, Alert, Linking } from "react-native";
import * as Notifications from "expo-notifications";
// import { capture } from "./sentry";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// TO SEND A NOTIFICATION MANUALLY
// Notifications.scheduleNotificationAsync({
//   content: {
//     title: 'Test Dev',
//     body: "I'm working!",
//   },
//   trigger: null,
// });

export async function registerForPushNotificationsAsync({ force = false, expo = false } = {}) {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== "granted") {
      if (!force) {
        return null;
      }
      const { status } = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
      finalStatus = status;
    }
    console.log("finalStatus", finalStatus);
    if (finalStatus !== "granted" && force) {
      Alert.alert(
        "Les notifications sont désactivées",
        "Vous pouvez activer les notifications dans les paramètres de votre téléphone.",
        [
          {
            text: "Open Settings",
            onPress: async () => {
              await Linking.openSettings();
            },
          },
          { text: "OK", style: "cancel", onPress: () => {} },
        ]
      );
      return;
    }
    const token = expo
      ? await Notifications.getExpoPushTokenAsync({
          projectId: "5c6b710c-a198-48f8-8f82-5597a1bcd0b7",
        })
      : await Notifications.getDevicePushTokenAsync();

    if (Platform.OS === "android") {
      Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF231F7C",
      });
    }
    return token;
  } catch (e) {
    console.log(e);
  }
}
