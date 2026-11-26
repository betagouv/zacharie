// @ts-nocheck
import { MATOMO_URL, MATOMO_IDSITE_1 } from '../config.js';
import { capture } from './sentry.js';

const __DEV__ = process.env.NODE_ENV === 'development';

class _MatomoBackend {
  init({ baseUrl, idsite, _idvc }) {
    this.baseUrl = baseUrl;
    this.idsite = idsite;
    this.initDone = true;
  }

  makeid(length = 16) {
    let result = '';
    const characters = '01234567890abcdefABCDEF';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
  }

  setCustomDimensions(newDimensions) {
    this.dimensions = {
      ...(this.dimensions || {}),
      ...newDimensions,
    };
  }

  computeCustomDimensions(dimensions) {
    const d = {};
    for (const [key, value] of Object.entries(dimensions)) {
      d[`dimension${key}`] = value;
    }
    return d;
  }

  computeParams(params, idsite) {
    params = {
      idsite,
      rec: 1,
      rand: Date.now(),
      ...params,
    };
    return Object.keys(params).reduce((paramString, key, index) => {
      const computedParam = `${key}=${params[key]}`;
      if (index === 0) return computedParam;
      return `${paramString}&${computedParam}`;
    }, '');
  }

  async logEvent({ userId, category, action, name = '', value = null }) {
    const params = {
      e_c: category,
      e_a: action,
      uid: userId,
      _id: userId,
    };
    if (name !== '') params.e_n = name;
    if (value !== null && !isNaN(Number(value))) params.e_v = Number(value);
    await this.execute(params);
  }

  async execute(params) {
    try {
      if (!this.initDone) throw new Error('matomo not initialized yet');
      const url = `${this.baseUrl}?${this.computeParams(params, this.idsite)}`;
      if (__DEV__) {
        return;
      }
      const res = await fetch(encodeURI(url));

      if (__DEV__ && res.status !== 200) {
        console.log(res);
        throw new Error('error fetching matomo');
      }
    } catch (e) {
      capture('matomo api error', e);
    }
  }
}

const matomo = new _MatomoBackend();
matomo.init({
  baseUrl: MATOMO_URL,
  idsite: MATOMO_IDSITE_1,
});

export default matomo;
