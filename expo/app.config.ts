import { ExpoConfig, ConfigContext } from 'expo/config';

const version = '1.1.3';
const buildNumber = '12';
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Zacharie',
  slug: 'zacharie-webapp-encapsulated',
  version,
  orientation: 'portrait',
  icon: './assets/icon.png',
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'fr.gouv.zacharie.v1',
    config: {
      usesNonExemptEncryption: false,
    },
    associatedDomains: ['applinks:zacharie.beta.gouv.fr'],
    buildNumber,
    infoPlist: {
      LSApplicationQueriesSchemes: ['zacharie'],
      CFBundleDevelopmentRegion: 'fr',
      CFBundleLocalizations: ['fr'],
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#FFFFFF',
    },

    package: 'fr.gouv.zacharie.v1',
    googleServicesFile: './google-services.json',
    versionCode: Number(buildNumber),
    permissions: ['android.permission.SCHEDULE_EXACT_ALARM', 'android.permission.WRITE_EXTERNAL_STORAGE'],
    softwareKeyboardLayoutMode: 'pan',
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [
          {
            scheme: 'zacharie',
          },
        ],
        category: ['BROWSABLE', 'DEFAULT'],
      },
      {
        action: 'VIEW',
        autoVerify: true,
        data: [
          {
            scheme: 'https',
            host: 'zacharie.beta.gouv.fr',
            pathPrefix: '/app',
          },
        ],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },
  locales: {
    fr: './languages/fr.json',
  },
  plugins: [
    [
      'expo-asset',
      {
        defaultChannel: 'PUSH-LOCAL-NOTIFICATIONS',
        color: '#FFFFFF',
        mode: 'production',
      },
    ],
    [
      'expo-splash-screen',
      {
        backgroundColor: '#FFFFFF',
        image: './assets/splash-icon.png',
        resizeMode: 'contain',
      },
    ],
    'expo-notifications',
    'expo-font',
    'expo-status-bar',
    [
      'expo-build-properties',
      {
        android: {
          minSdkVersion: 28,
          usesCleartextTraffic: true,
        },
      },
    ],
  ],
  extra: {
    eas: {
      projectId: '5c6b710c-a198-48f8-8f82-5597a1bcd0b7',
    },
  },
});
