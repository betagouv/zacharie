import fs from 'fs-extra';
import path from 'path';

// Le front a besoin du schéma Prisma et du référentiel des communes (recherche hors ligne) :
// api-express en est la source, le front en garde une copie commitée.
const copies = [
  { source: './prisma', destination: '../app-local-first-react-router/prisma' },
  { source: './src/data/villes.json', destination: '../app-local-first-react-router/src/data/villes.json' },
  {
    source: './src/utils/search-ville.ts',
    destination: '../app-local-first-react-router/src/utils/search-ville.ts',
  },
];

const copyToApp = async () => {
  for (const { source, destination } of copies) {
    try {
      await fs.copy(path.resolve(source), path.resolve(destination), {
        overwrite: true,
        errorOnExist: false,
      });
      console.log(`${source} successfully copied to app folder`);
    } catch (err) {
      console.error(`Error copying ${source}:`, err);
    }
  }
};

copyToApp();
