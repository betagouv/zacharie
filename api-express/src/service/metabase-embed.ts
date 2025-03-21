import jwt from 'jsonwebtoken';
import { METABASE_SECRET_KEY } from '../config';

const METABASE_SITE_URL = 'https://metabase.zacharie.beta.gouv.fr';

export function getIframeUrl(questionId: number) {
  const payload = {
    resource: { question: questionId },
    params: {},
    exp: Math.round(Date.now() / 1000) + 10 * 60, // 10 minute expiration
  };
  const token = jwt.sign(payload, METABASE_SECRET_KEY);
  return METABASE_SITE_URL + '/embed/question/' + token + '#bordered=true&titled=true';
}
