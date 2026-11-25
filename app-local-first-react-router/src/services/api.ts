import { disconnect } from '@app/utils/disconnect';
import { NATIVE_TOKEN_KEY } from '@app/services/indexed-db';

let API_URL = new URL(import.meta.env.VITE_API_URL);

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

const isNativeClient = () => typeof window !== 'undefined' && !!window.ReactNativeWebView;
export const getNativeAuthToken = (): string | null => {
  if (!isNativeClient()) return null;
  try {
    return window.localStorage.getItem(NATIVE_TOKEN_KEY);
  } catch {
    return null;
  }
};
export const setNativeAuthToken = (token: string | null): void => {
  if (!isNativeClient()) return;
  try {
    if (token) window.localStorage.setItem(NATIVE_TOKEN_KEY, token);
    else window.localStorage.removeItem(NATIVE_TOKEN_KEY);
  } catch {}
};

const UNEXPECTED_ERROR_MESSAGE =
  "Veuillez nous excuser, cette erreur est inattendue : l'équipe technique a été prévenue. Veuillez retenter dans quelques instants ou nous contacter si l'erreur persiste.";

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
      const nativeToken = getNativeAuthToken();
      const config = {
        method,
        credentials: 'include' as RequestCredentials,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          appversion: __VITE_BUILD_ID__,
          platform: window.ReactNativeWebView ? 'native' : 'web',
          ...(nativeToken ? { Authorization: `Bearer ${nativeToken}` } : {}),
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
        await disconnect({
          reason: '401',
          communication: 'Votre session a expiré, veuillez vous reconnecter.',
          redirectTo: window.location.pathname + window.location.search,
        });
        return {
          ok: false,
          error: 'Unauthorized',
        };
      }

      if (config.headers.Accept === 'application/json' && response.json) {
        try {
          const readableRes = await response.json();
          if (readableRes && typeof readableRes === 'object' && readableRes.data?.token) {
            setNativeAuthToken(readableRes.data.token);
          }
          if (response.status === 403 && readableRes?.error === 'PROCONNECT_REQUIRED') {
            if (window.location.pathname !== '/app/proconnect') {
              const redirect = encodeURIComponent(window.location.pathname + window.location.search);
              window.history.pushState({}, '', `/app/proconnect?redirect=${redirect}`);
              window.dispatchEvent(new PopStateEvent('popstate'));
            }
          }
          return readableRes;
        } catch (e) {
          console.log('ERROR IN RESPONSE JSON', response);
          console.log(e);
          return {
            ok: false,
            error: UNEXPECTED_ERROR_MESSAGE,
          };
        }
      }

      return response;
    } catch (e) {
      console.log(' error in api');
      console.log(e);
      return {
        ok: false,
        error: UNEXPECTED_ERROR_MESSAGE,
      };
    }
  };

  get = async (args: ApiServiceArgs) => this.execute({ method: 'GET', ...args });
  post = async (args: ApiServiceArgs) => this.execute({ method: 'POST', ...args });
  put = async (args: ApiServiceArgs) => this.execute({ method: 'PUT', ...args });
  delete = async (args: ApiServiceArgs) => this.execute({ method: 'DELETE', ...args });
}

const API = new ApiService();
export default API;
