import { test as base, expect } from '@playwright/test';

const TRANSMISSION_DIFFER_MESSAGE = 'Transmssion differs from one of the carcasses';

export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    const offendingLogs: string[] = [];
    const pendingDetails: Array<Promise<void>> = [];
    page.on('console', (msg) => {
      if (!msg.text().includes(TRANSMISSION_DIFFER_MESSAGE)) return;
      const contextArg = msg.args()[2];
      pendingDetails.push(
        (contextArg ? contextArg.jsonValue() : Promise.resolve(null))
          .then((context) => {
            offendingLogs.push(
              `${msg.text()} ${JSON.stringify({ tags: context?.tags, differ: context?.extra?.differ })}`
            );
          })
          .catch(() => {
            offendingLogs.push(msg.text());
          })
      );
    });
    await use(page);
    await Promise.all(pendingDetails);
    expect(
      offendingLogs,
      `capture('${TRANSMISSION_DIFFER_MESSAGE}') fired ${offendingLogs.length}× during "${testInfo.title}" — ` +
        'a transmission has carcasses that disagree on a shared field. This is a bug either in the app ' +
        'or in get-carcasses-transmission.ts.\n' +
        offendingLogs.join('\n')
    ).toHaveLength(0);
  },
});

export { expect };
export type { Page } from '@playwright/test';
