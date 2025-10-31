let API_URL = new URL(import.meta.env.VITE_API_URL);

/* 

so we use this app for web and also for the native Expo app, wrapped in a webview 
it happens that localhost doesn't work in the webview, so there we need the "network" server, http://x.x.x.x:3235
but then cookies conditions are different wether you use localhost or the network server
basically: when the url in the browser is http://localhost:3234, the api needs to be called with http://localhost:3235
but when the url in the browser is http://x.x.x.x:3234, the api needs to be called with http://x.x.x.x:3235

so here below is a trick when dev on a browser with localhost
*/
if (API_URL.protocol === 'http:') {
  if (!import.meta.env.VITEST) {
    if (window.location.origin.includes('localhost')) {
      API_URL = new URL(`http://localhost:${API_URL.port}`);
    }
  }
}

interface ApiServiceArgs {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path?: string;
  query?: Record<string, string>;
  headers?: Record<string, string>;
  body?: Record<string, unknown> | null;
  signal?: AbortSignal;
}

class ApiService {
  origin = import.meta.env.VITE_API_URL;
  getUrl = (path: string, query = {}) => {
    const url = new URL(API_URL);
    url.pathname = path;
    url.search = new URLSearchParams(query).toString();
    return url.toString();
  };
  execute = async ({
    method = 'GET',
    path = '',
    query = {},
    headers = {},
    body = null,
    signal,
  }: ApiServiceArgs) => {
    try {
      const config = {
        method,
        credentials: 'include' as RequestCredentials,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          appversion: __VITE_BUILD_ID__,
          platform: window.ReactNativeWebView ? 'native' : 'web',
          ...headers,
        },
        body: body ? JSON.stringify(body) : null,
        signal,
      };

      if (body) {
        if (config.headers['Content-Type'] === 'application/json') {
          config.body = JSON.stringify(body);
        } else {
          // @ts-expect-error body is not typed
          config.body = body;
        }
      }

      const url = this.getUrl(path, query);
      console.log('url: ', url);

      const response = await fetch(url, config);
      if (response.status === 401) {
        if (!window.location.href.includes('/app/connexion')) {
          const URLParams = new URLSearchParams(window.location.search);
          URLParams.set('communication', 'Votre session a expiré, veuillez vous reconnecter.');
          URLParams.set('type', 'compte-existant');
          URLParams.set('redirect', window.location.pathname + window.location.search);
          console.log('URLParams: ', URLParams.toString());
          window.location.href = '/app/connexion?' + URLParams.toString();
        }
        return {
          ok: false,
          error: 'Unauthorized',
        };
      }

      if (config.headers.Accept === 'application/json' && response.json) {
        try {
          const readableRes = await response.json();
          return readableRes;
        } catch (e) {
          console.log('ERROR IN RESPONSE JSON', response);
          console.log(e);
        }
      }

      return response;
    } catch (e) {
      console.log(' error in api');
      console.log(e);
      return {
        ok: false,
        error:
          "Veuillez nous excuser, cette erreur est inattendue : l'équipe technique a été prévenue. Veuillez retenter dans quelques instants ou nous contacter si l'erreur persiste.",
      };
    }
  };

  get = async (args: ApiServiceArgs) => this.execute({ method: 'GET', ...args });
  post = async (args: ApiServiceArgs) => this.execute({ method: 'POST', ...args });
  put = async (args: ApiServiceArgs) => this.execute({ method: 'PUT', ...args });
  delete = async (args: ApiServiceArgs) => this.execute({ method: 'DELETE', ...args });
  // uploadMedia = async (media, type) => {
  //   const formData = new FormData();
  //   const fileName = `${type === 'photo' ? 'photo' : 'video'}_${storage.getString('@UserId')}_${Date.now()}.${media.path.split('.').at(-1)}`;
  //   formData.append('media', {
  //     uri: media.path,
  //     type,
  //     name: fileName,
  //   });

  //   formData.append('mediaName', fileName.split('.')[0]); // Send filename without extension

  //   return this.post({
  //     path: '/media',
  //     body: formData,
  //     headers: {
  //       'Content-Type': 'multipart/form-data',
  //       Accept: 'application/json',
  //     },
  //   });
  // };
}

const API = new ApiService();
export default API;
