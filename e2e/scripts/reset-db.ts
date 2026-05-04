/// <reference types="node" />

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Function to wait for specific output from exec
function waitForExecOutput(command: string, expectedOutput: string, timeout: number = 30000): Promise<void> {
  return new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for: ${expectedOutput}`));
    }, timeout);

    const process = exec(command);

    const onData = (data: Buffer) => {
      const text = data.toString();
      output += text;
      console.log(text); // Log the output for debugging
      if (output.includes(expectedOutput)) {
        clearTimeout(timer);
        resolve();
      }
    };

    process.stdout?.on('data', onData);
    process.stderr?.on('data', onData);

    process.on('error', (error: Error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

export type SeedRole =
  | 'EXAMINATEUR_INITIAL'
  | 'PREMIER_DETENTEUR'
  | 'PREMIER_DETENTEUR_WITH_PARTAGE'
  | 'ETG'
  | 'ETG_TAKEN_CHARGE'
  | 'COLLECTEUR_PRO'
  | 'COLLECTEUR_TAKEN_CHARGE'
  | 'SVI'
  | 'COMMERCE_DE_DETAIL'
  | 'COMMERCE_DE_DETAIL_DELIVERED'
  | 'SVI_CLOSED'
  | 'ETG_REFUSED'
  | 'ETG_ALL_REFUSED_TO_SVI';

export async function resetDb(role?: SeedRole) {
  try {
    console.log('Resetting database...');

    // Populate the test database
    const populateCommand = `cd ../api-express && NODE_ENV=test POSTGRESQL_ADDON_URI=postgres://postgres:postgres@localhost:5432/zacharietest npm exec tsx -- ./scripts/populate-test-db.ts ${
      role ? `--role=${role}` : ''
    }`;

    await waitForExecOutput(populateCommand, 'Database populated successfully');
    console.log('Database reset and populated successfully');
  } catch (error) {
    console.error('Failed to reset database:', error);
  }
}
