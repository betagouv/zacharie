# Choix pour la stack

- on doit pouvoir utiliser l'app en mode offline, pour l'utiliser dans les zones blanches en plein chasse
- on doit pouvoir l'utiliser autant sur un smartphone que sur un ordinateur
- on n'a a priori pas besoin du marketing d'une app mobile
- on peut a priori se passer d'un deeplink

On a donc choisi
- du Web
- une PWA
- Remix

# Steps d'installation de la stack

Ce paragraphe est juste un historique pour se souvenir, pas une doc à utiliser

- [`yarn set version stable`](https://yarnpkg.com/getting-started/install#updating-yarn) pour avoir la dernière version de yarn (v4)
- [`npx create-remix@latest --template remix-run/remix/templates/spa`](https://remix.run/docs/en/main/guides/spa-mode#usage) parce qu'on pense que le côté SPA est plus adapté à notre usage offline
- `touch yarn.lock` pour utiliser yarn en package manager
- [`touch .yarnrc.yml`](https://stackoverflow.com/a/78719394/5225096) pour utiliser les node_modules (sinon ça utilise un pnp.cjs moins conventionnel), avec le contenu que vous pouvez aller voir dans le fichier
- puis `yarn` pour installer

- enfin, [setup de remix-pwa](https://remix-pwa.run/docs/main/quick-start)
- [setup du mode Offline](https://remix-pwa.run/docs/main/offline)




# templates/spa

This template leverages [Remix SPA Mode](https://remix.run/docs/en/main/guides/spa-mode) to build your app as a Single-Page Application using [Client Data](https://remix.run/docs/en/main/guides/client-data) for all of your data loads and mutations.

## Setup

```shellscript
npx create-remix@latest --template remix-run/remix/templates/spa
```

## Development

You can develop your SPA app just like you would a normal Remix app, via:

```shellscript
npm run dev
```

## Production

When you are ready to build a production version of your app, `npm run build` will generate your assets and an `index.html` for the SPA.

```shellscript
npm run build
```

### Preview

You can preview the build locally with [vite preview](https://vitejs.dev/guide/cli#vite-preview) to serve all routes via the single `index.html` file:

```shellscript
npm run preview
```

> [!IMPORTANT]
>
> `vite preview` is not designed for use as a production server

### Deployment

You can then serve your app from any HTTP server of your choosing. The server should be configured to serve multiple paths from a single root `/index.html` file (commonly called "SPA fallback"). Other steps may be required if the server doesn't directly support this functionality.

For a simple example, you could use [sirv-cli](https://www.npmjs.com/package/sirv-cli):

```shellscript
npx sirv-cli build/client/ --single
```

## Styling

This template comes with [Tailwind CSS](https://tailwindcss.com/) already configured for a simple default starting experience. You can use whatever css framework you prefer. See the [Vite docs on css](https://vitejs.dev/guide/features.html#css) for more information.
