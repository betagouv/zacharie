import { File, Directory, Paths } from 'expo-file-system';
import { fetch } from 'expo/fetch';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Server, { STATES } from '@dr.pogodin/react-native-static-server';

const APP_URL = 'https://zacharie.beta.gouv.fr/';
const SPA_DIR = new Directory(Paths.document, 'spa');

let forceRefreshKey = '1';

export const checkAndDownloadSpa = async (): Promise<void> => {
  const MANIFEST_URL = `${APP_URL}spa-manifest.json`;
  try {
    console.log('Checking for SPA update...');
    const manifestResponse = await fetch(MANIFEST_URL);
    console.log('manifestResponse: ', manifestResponse);
    if (!manifestResponse.ok) {
      console.warn('Failed to fetch spa-manifest.json, using fallback or online only');
      return;
    }
    const manifest = (await manifestResponse.json()) as { assets: { url: string }[] };
    const manifestVersioning = JSON.stringify(manifest);
    const assets = manifest.assets;

    const localVersioning = await AsyncStorage.getItem('spa-versioning');
    const localForceRefreshKey = await AsyncStorage.getItem('spa-force-refresh-key');

    if (manifestVersioning === localVersioning && localForceRefreshKey === forceRefreshKey) {
      console.log('SPA is up to date');
      if (SPA_DIR.exists) return;
    }

    console.log('New version detected or missing files. Downloading SPA...');

    if (!SPA_DIR.exists) {
      SPA_DIR.create();
    }

    let downloadedCount = 0;

    for (const asset of assets) {
      const url = asset.url.startsWith('/') ? asset.url.substring(1) : asset.url;
      const remoteUrl = `${APP_URL}${url}`;

      const file = new File(SPA_DIR, url);
      if (file.parentDirectory && !file.parentDirectory.exists) {
        file.parentDirectory.create({ intermediates: true });
      }

      try {
        const assetResponse = await fetch(remoteUrl);
        if (!assetResponse.ok) throw new Error(`Failed to fetch ${remoteUrl}`);

        const bytes = await assetResponse.bytes();
        await file.write(bytes);

        downloadedCount++;
      } catch (e) {
        console.error(`Failed to download ${remoteUrl}`, e);
      }
    }

    console.log(`Downloaded ${downloadedCount} assets`);

    await AsyncStorage.setItem('spa-versioning', manifestVersioning);
    await AsyncStorage.setItem('spa-force-refresh-key', forceRefreshKey);
  } catch (error) {
    console.error('Error in checkAndDownloadSpa:', error);
  }
};

export const SPA_SERVER_HOSTNAME = '127.0.0.1';
export const SPA_SERVER_PORT = 3000;
export const SPA_SERVER_ORIGIN = `http://${SPA_SERVER_HOSTNAME}:${SPA_SERVER_PORT}`;

let serverInstance: Server | null = null;
let serverOrigin: string | null = null;

export const startSpaServer = async (): Promise<string | null> => {
  try {
    const indexFile = new File(SPA_DIR, 'index.html');
    if (!indexFile.exists) {
      console.log('No SPA index.html, cannot start server');
      return null;
    }

    if (serverInstance && serverOrigin) {
      return serverOrigin;
    }

    const fileDir = SPA_DIR.uri.replace(/^file:\/\//, '');

    serverInstance = new Server({
      fileDir,
      hostname: SPA_SERVER_HOSTNAME,
      port: SPA_SERVER_PORT,
      stopInBackground: Platform.select({
        android: undefined,
        ios: 1000,
        macos: 1000,
      }),
      errorLog: {
        conditionHandling: true,
        fileNotFound: true,
        requestHandling: true,
        requestHeader: true,
        requestHeaderOnError: true,
        responseHeader: true,
        timeouts: true,
      },
      extraConfig: `
        server.modules += ("mod_rewrite")
        url.rewrite-if-not-file = ( "^/(.*)$" => "/index.html" )
      `,
    });

    serverInstance.addStateListener((newState, details, error) => {
      console.log(`SPA server state: ${STATES[newState]}`, { details, origin: serverInstance?.origin });
      if (error) console.error('SPA server error:', error);
    });

    const url = await serverInstance.start();
    serverOrigin = url ?? null;
    console.log('SPA static server started at', serverOrigin);
    return serverOrigin;
  } catch (error) {
    console.error('Error starting SPA server:', error);
    return null;
  }
};

export const stopSpaServer = async (): Promise<void> => {
  try {
    if (serverInstance) {
      await serverInstance.stop();
    }
  } catch (error) {
    console.error('Error stopping SPA server:', error);
  } finally {
    serverInstance = null;
    serverOrigin = null;
  }
};

export const isSpaUpdateAvailable = async (): Promise<boolean> => {
  try {
    const manifestResponse = await fetch(`${APP_URL}spa-manifest.json`);
    if (!manifestResponse.ok) return false;
    const manifestVersioning = JSON.stringify(await manifestResponse.json());
    const localVersioning = await AsyncStorage.getItem('spa-versioning');
    return manifestVersioning !== localVersioning;
  } catch (error) {
    console.error('Error in isSpaUpdateAvailable:', error);
    return false;
  }
};
