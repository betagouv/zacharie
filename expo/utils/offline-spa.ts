import { File, Directory, Paths } from 'expo-file-system';
import { fetch } from 'expo/fetch';
import AsyncStorage from '@react-native-async-storage/async-storage';

const APP_URL = __DEV__ ? process.env.EXPO_PUBLIC_APP_URL : "https://zacharie.beta.gouv.fr/";
const SPA_DIR = new Directory(Paths.document, 'spa');
const MANIFEST_URL = `${APP_URL}spa-manifest.json`;
const VERSION_URL = `${APP_URL}`; // GET / returns version string

export const checkAndDownloadSpa = async (): Promise<void> => {
  try {
    // 1. Get remote version
    console.log('Checking for SPA update...');
    const response = await fetch(VERSION_URL);
    if (!response.ok) throw new Error('Failed to fetch version');
    
    // The endpoint returns something like "Hello World at 2026-01-01... version 1.2.3"
    // We can just use the whole string as a signature, or extract version
    const remoteVersionText = await response.text();
    
    // 2. Get local version
    const localVersionText = await AsyncStorage.getItem('spa-version');

    if (remoteVersionText === localVersionText) {
      console.log('SPA is up to date');
      // Check if we actually have files, if not, force download
      if (SPA_DIR.exists) return;
    }

    console.log('New version detected or missing files. Downloading SPA...');
    
    // 3. Download manifest
    const manifestResponse = await fetch(MANIFEST_URL);
    if (!manifestResponse.ok) {
        console.warn('Failed to fetch spa-manifest.json, using fallback or online only');
        return;
    }
    const manifest = await manifestResponse.json() as { assets: { url: string }[] };
    const assets = manifest.assets;

    // 4. Create directory
    if (!SPA_DIR.exists) {
      SPA_DIR.create();
    }

    // 5. Download files
    let downloadedCount = 0;
    
    for (const asset of assets) {
        const url = asset.url.startsWith('/') ? asset.url.substring(1) : asset.url; // Remove leading slash
        const remoteUrl = `${APP_URL}${url}`;
        
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
    await AsyncStorage.setItem('spa-version', remoteVersionText);

  } catch (error) {
    console.error('Error in checkAndDownloadSpa:', error);
  }
};

export const getOfflineHtml = async (): Promise<string | null> => {
  try {
    const indexFile = new File(SPA_DIR, 'index.html');
    
    if (!indexFile.exists) return null;
    
    return indexFile.text();
  } catch (error) {
    console.error('Error reading offline HTML:', error);
    return null;
  }
};

export const getLocalBaseUrl = () => {
    return SPA_DIR.uri;
};
