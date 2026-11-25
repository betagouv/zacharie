import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const srcDir = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

const NOT_A_PAGE = new Set(['Navigate', 'Outlet', 'RootDisplay', 'TableauDeBordRedirect', 'TestSentry']);

function listFilesRecursively(dir: string): Array<string> {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? listFilesRecursively(fullPath) : [fullPath];
  });
}

function resolveModule(fromFile: string, specifier: string): string | null {
  const base = specifier.startsWith('@app/')
    ? path.join(srcDir, specifier.slice('@app/'.length))
    : path.resolve(path.dirname(fromFile), specifier);
  for (const candidate of [base, `${base}.tsx`, `${base}.ts`, `${base}/index.tsx`, `${base}/index.ts`]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

function defaultImportsOf(file: string, source: string): Map<string, string> {
  const imports = new Map<string, string>();
  for (const match of source.matchAll(/^import\s+([^\s,{}]+)\s*(?:,\s*\{[^}]*\})?\s+from\s+'([^']+)';/gm)) {
    const resolved = resolveModule(file, match[2]);
    if (resolved) imports.set(match[1], resolved);
  }
  return imports;
}

function followReExport(file: string): string {
  let current = file;
  for (let depth = 0; depth < 5; depth++) {
    const source = fs.readFileSync(current, 'utf8');
    const reExport = source.match(/^export\s+\{\s*default\s*\}\s+from\s+'([^']+)';/m);
    if (!reExport) return current;
    const next = resolveModule(current, reExport[1]);
    if (!next) return current;
    current = next;
  }
  return current;
}

const routerFiles = [
  path.join(srcDir, 'App.tsx'),
  ...listFilesRecursively(path.join(srcDir, 'routes')).filter((file) => file.endsWith('-router.tsx')),
];

const pages = new Map<string, Array<string>>();
for (const routerFile of routerFiles) {
  const source = fs.readFileSync(routerFile, 'utf8');
  const imports = defaultImportsOf(routerFile, source);
  for (const match of source.matchAll(/element=\{\s*<([A-Za-zÀ-ÿ0-9_]+)/g)) {
    const componentName = match[1];
    if (NOT_A_PAGE.has(componentName)) continue;
    if (componentName.endsWith('Layout')) continue;
    const moduleFile = imports.get(componentName);
    if (!moduleFile) continue;
    const pageFile = path.relative(srcDir, followReExport(moduleFile));
    pages.set(pageFile, [...(pages.get(pageFile) ?? []), componentName]);
  }
}

describe('toutes les pages posent un <title>', () => {
  it('trouve les pages depuis les routeurs', () => {
    expect(routerFiles.length).toBeGreaterThan(5);
    expect(pages.size).toBeGreaterThan(40);
  });

  it.each([...pages.keys()].sort())('%s rend un <title>', (pageFile) => {
    const file = path.join(srcDir, pageFile);
    const source = fs.readFileSync(file, 'utf8');
    const gabaritsAvecTitre = [...defaultImportsOf(file, source)]
      .filter(([componentName]) => source.includes(`<${componentName}`))
      .filter(([, componentFile]) => fs.readFileSync(componentFile, 'utf8').includes('<title>'));
    expect(source.includes('<title>') || gabaritsAvecTitre.length > 0).toBe(true);
  });
});
