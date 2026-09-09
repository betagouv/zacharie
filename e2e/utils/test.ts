import { test as base, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// `capture('Transmssion differs from one of the carcasses')` is a "this must never happen" telemetry:
// every carcasse of a single transmission must agree on the fields they share (see
// app-local-first-react-router/src/utils/get-carcasses-transmission.ts). If it ever fires during any
// e2e flow, either the transmission util is wrong or the app has corrupted a carcasse — both are bugs.
// So we guard EVERY test: watch the page console and fail on teardown if the message ever appeared.
//
// Specs import { test, expect } from this module instead of '@playwright/test' to get the guard for free.
const TRANSMISSION_DIFFER_MESSAGE = 'Transmssion differs from one of the carcasses';

const coverageDir = path.join(__dirname, '..', '.nyc_output');

export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    const offendingLogs: string[] = [];
    page.on('console', (msg) => {
      if (msg.text().includes(TRANSMISSION_DIFFER_MESSAGE)) {
        offendingLogs.push(msg.text());
      }
    });
    await use(page);

    // Collect Istanbul coverage from the browser
    const coverage = await page.evaluate(() => (window as any).__coverage__);
    // TODO: remove after verifying coverage works in CI
    const hasCoverage = coverage != null;
    const keyCount = hasCoverage ? Object.keys(coverage).length : 0;
    console.log(`[coverage] __coverage__ present: ${hasCoverage}, keys: ${keyCount}, dir: ${coverageDir}`);
    if (coverage) {
      if (!fs.existsSync(coverageDir)) {
        fs.mkdirSync(coverageDir, { recursive: true });
      }
      const safeName = testInfo.titlePath.join('--').replace(/[^a-zA-Z0-9-]/g, '_');
      const filePath = path.join(coverageDir, `coverage-${safeName}-${testInfo.workerIndex}.json`);
      fs.writeFileSync(filePath, JSON.stringify(coverage));
    }

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
