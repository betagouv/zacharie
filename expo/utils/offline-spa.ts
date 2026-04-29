import { File, Directory, Paths } from 'expo-file-system';
import { fetch } from 'expo/fetch';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Server, { STATES } from '@dr.pogodin/react-native-static-server';

const SPA_DIR = new Directory(Paths.document, 'spa');

export const checkAndDownloadSpa = async (initialUrl: string): Promise<void> => {
  const MANIFEST_URL = `${initialUrl}spa-manifest.json`;
  try {
    // 1. Get remote version
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

    // The endpoint returns something like "Hello World at 2026-01-01... version 1.2.3"
    // We can just use the whole string as a signature, or extract version

    // 2. Get local version
    const localVersioning = await AsyncStorage.getItem('spa-versioning');

    if (manifestVersioning === localVersioning) {
      console.log('SPA is up to date');
      // Check if we actually have files, if not, force download
      if (SPA_DIR.exists) return;
    }

    console.log('New version detected or missing files. Downloading SPA...');

    // 4. Create directory
    if (!SPA_DIR.exists) {
      SPA_DIR.create();
    }

    // 5. Download files
    let downloadedCount = 0;

    for (const asset of assets) {
      const url = asset.url.startsWith('/') ? asset.url.substring(1) : asset.url; // Remove leading slash
      const remoteUrl = `${initialUrl}${url}`;

      const file = new File(SPA_DIR, url);
      // Ensure parent directory exists
      if (file.parentDirectory && !file.parentDirectory.exists) {
        file.parentDirectory.create({ intermediates: true });
      }

      try {
        const assetResponse = await fetch(remoteUrl);
        if (!assetResponse.ok) throw new Error(`Failed to fetch ${remoteUrl}`);

        // Write bytes to file
        const bytes = await assetResponse.bytes();
        file.write(bytes);

        downloadedCount++;
      } catch (e) {
        console.error(`Failed to download ${remoteUrl}`, e);
      }
    }

    console.log(`Downloaded ${downloadedCount} assets`);

    // 6. Update version
    await AsyncStorage.setItem('spa-versioning', manifestVersioning);
  } catch (error) {
    console.error('Error in checkAndDownloadSpa:', error);
  }
};

// Pinned host/port so the API CORS allowlist can include this exact origin.
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

    // Static-server expects a plain absolute path, not a file:// URI
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
      // SPA fallback: any URL that doesn't resolve to an existing file
      // (e.g. /app/chasseur/tableau-de-bord) is served from /index.html so
      // React Router can handle the route on the client.
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
