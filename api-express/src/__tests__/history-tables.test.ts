import fs from 'fs';
import path from 'path';
import { describe, test, expect } from 'vitest';

// Le trigger history_trigger copie chaque version précédente dans "<Table>History" par nom de colonne :
// une colonne oubliée dans l'historique n'y est jamais enregistrée. Toute colonne ajoutée à une table
// historisée doit donc l'être aussi, nullable, dans son modèle History.
const HISTORIZED_TABLES = ['Fei', 'Carcasse', 'CarcasseIntermediaire', 'User', 'Entity', 'EntityAndUserRelations'];
const HISTORY_ONLY_FIELDS = ['history_id', 'history_op', 'sys_period'];

const schema = fs.readFileSync(path.resolve(__dirname, '../../prisma/schema.prisma'), 'utf8');
const modelNames = new Set([...schema.matchAll(/^model (\w+) \{/gm)].map((m) => m[1]));

// colonnes scalaires d'un modèle : nom -> type (sans `?`) + type natif @db.*
function getColumns(model: string) {
  const body = schema.match(new RegExp(`^model ${model} \\{\\n([\\s\\S]*?)^\\}`, 'm'))?.[1];
  if (!body) throw new Error(`model ${model} introuvable`);
  const columns: Record<string, string> = {};
  for (const line of body.split('\n')) {
    const match = line.match(/^\s+(\w+)\s+(\w+)(\[\])?(\?)?(.*)$/);
    if (!match || modelNames.has(match[2])) continue;
    const [, field, type, list, , rest] = match;
    const nativeType = rest.match(/@db\.\w+(\([^)]*\))?/)?.[0] ?? '';
    columns[field] = `${type}${list ?? ''} ${nativeType}`.trim();
  }
  return columns;
}

describe('tables History', () => {
  test.each(HISTORIZED_TABLES)('%sHistory a les mêmes colonnes que %s', (table) => {
    const historyColumns = getColumns(`${table}History`);
    for (const field of HISTORY_ONLY_FIELDS) delete historyColumns[field];
    expect(historyColumns).toEqual(getColumns(table));
  });

  test.each(HISTORIZED_TABLES)('les colonnes de %sHistory sont nullables', (table) => {
    const body = schema.match(new RegExp(`^model ${table}History \\{\\n([\\s\\S]*?)^\\}`, 'm'))![1];
    const requiredFields = body
      .split('\n')
      .map((line) => line.match(/^\s+(\w+)\s+(\w+)(\[\])?(\?)?/))
      .filter((match) => match && !match[3] && !match[4] && !HISTORY_ONLY_FIELDS.includes(match[1]))
      .map((match) => match![1]);
    expect(requiredFields).toEqual([]);
  });
});
