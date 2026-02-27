import type { UserConnexionResponse } from '~/src/types/responses';
import useZustandStore from '../store';

export function setApiKeyApprovals(apiKeyApprovals: UserConnexionResponse['data']['apiKeyApprovals']) {
  useZustandStore.setState({ apiKeyApprovals });
}
