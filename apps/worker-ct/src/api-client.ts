import { logger } from './logger.js';

export interface MasterAccount {
  metaApiAccountId: string;
  masterId: string;
}

export async function fetchMasterAccounts(apiUrl: string): Promise<MasterAccount[]> {
  try {
    const resp = await fetch(`${apiUrl}/api/v1/mt4-accounts/masters`);
    if (!resp.ok) {
      logger.warn({ status: resp.status }, 'API returned non-OK status for master accounts');
      return [];
    }
    return (await resp.json()) as MasterAccount[];
  } catch (err) {
    logger.warn({ err }, 'API not available, starting without master accounts');
    return [];
  }
}
