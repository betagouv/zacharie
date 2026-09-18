import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packages = ['api-express', 'app-local-first-react-router', 'e2e'];

export default {
  '*': (stagedFiles) => {
    const commands = [];
    const pkgAbsDirs = packages.map((p) => ({ name: p, dir: path.join(__dirname, p) + '/' }));

    for (const { name, dir } of pkgAbsDirs) {
      const files = stagedFiles.filter((f) => f.startsWith(dir));
      if (files.length) {
        const rel = files.map((f) => JSON.stringify(path.relative(dir, f)));
        commands.push(`cd ${name} && npx prettier --write --ignore-unknown ${rel.join(' ')}`);
      }
    }

    const rootFiles = stagedFiles.filter((f) => !pkgAbsDirs.some(({ dir }) => f.startsWith(dir)));
    if (rootFiles.length) {
      commands.push(`npx prettier --write --ignore-unknown ${rootFiles.map((f) => JSON.stringify(f)).join(' ')}`);
    }

    return commands;
  },
};
