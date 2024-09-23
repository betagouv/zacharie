Automatic reload
With this behavior, once the browser detects a new version of your application, then, it will update the caches and will reload any browser windows/tabs with the application opened automatically to take the control.

WARNING
In order to reload all client tab/window, you will need to import any virtual module provided by the plugin: if you're not using any virtual, there is no way to interact with the application ui, and so, any client tab/window will not be reloaded (the old service worker will be still controlling the application).

Automatic reload is not automatic page reload, you will need to use the following code in your application entry point if you want automatic page reload:

js
import { registerSW } from 'virtual:pwa-register'

registerSW({ immediate: true })
The disadvantage of using this behavior is that the user can lose data in any browser windows/tabs in which the application is open and is filling in a form.

If your application has forms, we recommend you to change the behavior to use default prompt option to allow the user decide when to update the content of the application.

DANGER
Before you put your application into production, you need to be sure of the behavior you want for the service worker. Changing the behavior of the service worker from autoUpdate to prompt can be a pain.

Plugin Configuration

With this option, the plugin will force workbox.clientsClaim and workbox.skipWaiting to true on the plugin options.

You must add registerType: 'autoUpdate' to vite-plugin-pwa plugin options in your vite.config.ts file:

ts
VitePWA({
  registerType: 'autoUpdate'
})
Cleanup Outdated Caches
The service worker will store all your application assets in a browser cache (or set of caches). Every time you make changes to your application and rebuild it, the service worker will also be rebuilt, including in its precache manifest all new modified assets, which will have their revision changed (all assets that have been modified will have a new version). Assets that have not been modified will also be included in the service worker precache manifest, but their revision will not change from the previous one.

Precache Manifest Entry Revision
The precache manifest entry revision is just a MD5 hash of the asset content, if an asset is not modified, the calculated hash will be always the same.

When the browser detects and installs the new version of your application, it will have in the cache storage all new assets and also the old ones. To delete old assets (from previous versions that are no longer necessary), you have to configure an option in the workbox entry of the plugin configuration.

When using the generateSW strategy, it is not necessary to configure it, the plugin will activate it by default.

We strongly recommend you to NOT deactivate the option. If you are curious, you can deactivate it using the following code in your plugin configuration:

ts
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    VitePWA({
      workbox: {
        cleanupOutdatedCaches: false
      }
    })
  ]
})
Inject Manifest Source Map new options from v0.18.0+
INFO
From v0.18.0+ you can use minify, sourcemap and enableWorkboxModulesLogs in your injectManifest configuration option, check New Vite Build section for more details.

Since you are building your own service worker, this plugin will use Vite's build.sourcemap configuration option, which default value is false, to generate the source map.

If you want to generate the source map for your service worker, you will need to generate the source map for the entire application.

Generate SW Source Map
Since plugin version 0.11.2, your service worker's source map will not be generated as it uses the build.sourcemap option from the Vite config, which by default is false.

Your service worker source map will be generated when Vite's build.sourcemap configuration option has the value true, 'inline' or 'hidden', and you have not configured the workbox.sourcemap option in the plugin configuration. If you configure the workbox.sourcemap option, the plugin will not change that value.

If you want to generate the source map of your service worker, you can use this code:

ts
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    VitePWA({
      workbox: {
        sourcemap: true
      }
    })
  ]
})
Importing Virtual Modules

With this behavior, you must import one of the virtual modules exposed by vite-plugin-pwa plugin only if you need to prompt a dialog to the user when the application is ready to work offline, otherwise you can import or just omit it.

If you don't import one of the virtual modules, the automatic reload will still work.

Ready To Work Offline
You must include the following code on your main.ts or main.js file:

ts
import { registerSW } from 'virtual:pwa-register'

const updateSW = registerSW({
  onOfflineReady() {},
})
You will need to show a ready to work offline dialog to the user with an OK button inside onOfflineReady callback.

When the user clicks the OK button, just hide the prompt shown on onOfflineReady method.

SSR/SSG
If you are using SSR/SSG, you need to import virtual:pwa-register module using dynamic import and checking if window is not undefined.

You can register the service worker on src/pwa.ts module:

ts
import { registerSW } from 'virtual:pwa-register'

registerSW({ /* ... */ })
and then import it from your main.ts:

ts
if (typeof window !== 'undefined')
  import('./pwa')
You can see the FAQ entry for more info.