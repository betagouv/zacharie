import { useState, useCallback } from 'react';
import { read, utils } from '@e965/xlsx';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Table } from '@codegouvfr/react-dsfr/Table';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import { Badge } from '@codegouvfr/react-dsfr/Badge';
import { Checkbox } from '@codegouvfr/react-dsfr/Checkbox';
import API from '@app/services/api';
import type { AdminCcgPreviewResponse, AdminCcgImportResponse, CcgPreviewRow, CcgPreviewModifiedRow } from '@api/src/types/responses';

type Step = 'upload' | 'preview' | 'result';

export default function CcgImport() {
  const [step, setStep] = useState<Step>('upload');
  const [nouveaux, setNouveaux] = useState<CcgPreviewRow[]>([]);
  const [modifies, setModifies] = useState<CcgPreviewModifiedRow[]>([]);
  const [unchangedCount, setUnchangedCount] = useState(0);
  const [selectedForUpdate, setSelectedForUpdate] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ created: number; updated: number; skipped: number } | null>(null);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setLoading(true);

    try {
      const data = await file.arrayBuffer();
      const workbook = read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonRows = utils.sheet_to_json<Record<string, string>>(sheet, { defval: '', range: 4 });

      if (jsonRows.length === 0) {
        setError('Le fichier est vide.');
        setLoading(false);
        return;
      }

      // Normalize a key: collapse all whitespace (spaces, \r, \n) into a single space, then trim
      const normalize = (s: string) => s.replace(/[\s]+/g, ' ').trim();

      // Build a normalized lookup from a row, then find the first matching normalized target
      const col = (normalizedRow: Map<string, string>, ...targets: string[]) => {
        for (const t of targets) {
          const v = normalizedRow.get(normalize(t));
          if (v !== undefined) return v;
        }
        return '';
      };

      const mapped: CcgPreviewRow[] = jsonRows.map((row) => {
        const normalizedRow = new Map<string, string>();
        for (const [k, v] of Object.entries(row)) {
          normalizedRow.set(normalize(k), String(v).trim());
        }
        return {
          numero_ddecpp: (() => {
            const raw = col(normalizedRow, 'Unité Activité (UA) : Identifier métier (Type : Valorisation)', 'numero_ddecpp', 'Numéro DDECPP');
            const match = raw.match(/\d{2,3}-CCG-\d+/);
            return match ? match[0] : raw;
          })(),
          nom_d_usage: col(normalizedRow, 'Établissement : Enseigne usuelle (RESYTAL)', 'nom_d_usage', 'raison_sociale', 'Raison sociale'),
          address_ligne_1: col(
            normalizedRow,
            'Unité Activité (UA) : Adresse de localisation : Concaténations des lignes adresses 1, 2 & 3',
            'Établissement : Adresse postale : Concaténations des lignes adresses 1, 2 & 3',
            'address_ligne_1',
            'Adresse'
          ),
          address_ligne_2: '',
          code_postal: col(
            normalizedRow,
            "Unité d'Activité (UA) : Code postal (Adresse de localisation)",
            'Établissement : Adresse postale: Code postal',
            'code_postal',
            'Code postal'
          ),
          ville: col(
            normalizedRow,
            'Unité Activité (UA) : Adresse de localisation : Commune Nom',
            'Établissement : Adresse postale: Bureau distributeur',
            'ville',
            'Ville'
          ),
          siret: col(normalizedRow, 'Établissement : SIRET/NUMAGRIT', 'siret', 'SIRET'),
        };
      });

      const validRows = mapped.filter((r) => /^\d{2,3}-CCG-\d+$/.test(r.numero_ddecpp));
      if (validRows.length === 0) {
        setError("Aucune ligne avec un numero_ddecpp n'a été trouvée. Vérifiez les colonnes du fichier.");
        setLoading(false);
        return;
      }

      const response = (await API.post({
        path: 'admin/ccg/preview',
        body: { ccgs: validRows },
      })) as AdminCcgPreviewResponse;

      if (!response.ok) {
        setError(response.error || 'Erreur lors de la vérification.');
        setLoading(false);
        return;
      }

      setNouveaux(response.data.nouveaux);
      setModifies(response.data.modifies);
      setUnchangedCount(response.data.unchanged_count);
      setSelectedForUpdate(new Set(response.data.modifies.map((r) => r.numero_ddecpp)));
      setStep('preview');
    } catch {
      setError("Erreur lors de la lecture du fichier. Vérifiez qu'il s'agit d'un fichier CSV ou Excel valide.");
    } finally {
      setLoading(false);
    }
  }, []);

  const displayedRows: Array<CcgPreviewRow | CcgPreviewModifiedRow> = [...nouveaux, ...modifies];

  const toggleUpdate = useCallback((numeroDdecpp: string) => {
    setSelectedForUpdate((prev) => {
      const next = new Set(prev);
      if (next.has(numeroDdecpp)) {
        next.delete(numeroDdecpp);
      } else {
        next.add(numeroDdecpp);
      }
      return next;
    });
  }, []);

  const toggleAllExisting = useCallback(
    (checked: boolean) => {
      if (checked) {
        setSelectedForUpdate(new Set(modifies.map((r) => r.numero_ddecpp)));
      } else {
        setSelectedForUpdate(new Set());
      }
    },
    [modifies]
  );

  const handleImport = useCallback(async () => {
    setLoading(true);
    setError('');

    const ccgs = [
      ...nouveaux.map((row) => ({ ...row, action: 'create' as const })),
      ...modifies.map((row) => {
        const { existing: _, ...rest } = row;
        const action = selectedForUpdate.has(row.numero_ddecpp) ? ('update' as const) : ('skip' as const);
        return { ...rest, action };
      }),
    ];

    const response = (await API.post({
      path: 'admin/ccg/import',
      body: { ccgs },
    })) as AdminCcgImportResponse;

    if (!response.ok) {
      setError(response.error || "Erreur lors de l'import.");
      setLoading(false);
      return;
    }

    setResult(response.data);
    setStep('result');
    setLoading(false);
  }, [nouveaux, modifies, selectedForUpdate]);

  const reset = useCallback(() => {
    setStep('upload');
    setNouveaux([]);
    setModifies([]);
    setUnchangedCount(0);
    setSelectedForUpdate(new Set());
    setResult(null);
    setError('');
  }, []);

  return (
    <div className="fr-container p-4 md:p-8">
      <title>Import CCG | Admin | Zacharie</title>
      <h1>Importer des CCG depuis un fichier CSV/XLS</h1>

      {error && (
        <Alert
          severity="error"
          title="Erreur"
          description={error}
          className="mb-4"
        />
      )}

      {step === 'upload' && (
        <div className="mb-8">
          <p className="mb-4">
            Sélectionnez un fichier Excel CCG (format RESYTAL, en-têtes en ligne 5). Les colonnes utilisées sont&nbsp;:{' '}
            <code>Unité Activité (UA) : Identifier métier</code>, <code>Établissement : Enseigne usuelle</code>, <code>Adresse postale</code>,{' '}
            <code>Code postal</code>, <code>Bureau distributeur</code>, <code>SIRET/NUMAGRIT</code>
          </p>
          <input
            type="file"
            accept=".csv,.xls,.xlsx"
            onChange={handleFileChange}
            disabled={loading}
            className="fr-input"
            placeholder="Sélectionnez un fichier Excel CCG (format RESYTAL, en-têtes en ligne 5)"
          />
          {loading && <p className="mt-2">Chargement...</p>}
        </div>
      )}

      {step === 'preview' && (
        <>
          <div className="mb-4 flex items-center gap-4">
            <Badge severity="success">{nouveaux.length} nouveau(x)</Badge>
            <Badge severity="warning">{modifies.length} existant(s) avec modifications</Badge>
            {unchangedCount > 0 && <Badge severity="info">{unchangedCount} existant(s) sans modification (masqués)</Badge>}
          </div>

          {modifies.length > 0 && (
            <div className="mb-4">
              <Checkbox
                options={[
                  {
                    label: `Mettre à jour tous les existants (${modifies.length})`,
                    nativeInputProps: {
                      checked: selectedForUpdate.size === modifies.length && modifies.length > 0,
                      onChange: (e) => toggleAllExisting(e.target.checked),
                    },
                  },
                ]}
              />
            </div>
          )}

          <div className="mb-4 overflow-x-auto">
            <Table
              fixed
              noCaption
              className="[&_td]:align-middle"
              headers={['Statut', 'N° DDECPP', 'Nom', 'Adresse', 'CP', 'Ville', 'SIRET', 'Action']}
              data={displayedRows.map((row) => {
                const isModified = 'existing' in row;
                const existing = isModified ? (row as CcgPreviewModifiedRow).existing : null;
                const diffCell = (newVal: string, oldVal: string | undefined) => {
                  if (!existing || oldVal === undefined || oldVal === newVal) return newVal;
                  return (
                    <span>
                      <span className="text-red-500 line-through">{oldVal}</span> <span className="font-bold text-green-600">{newVal}</span>
                    </span>
                  );
                };
                return [
                  isModified ? (
                    <Badge
                      key="badge"
                      severity="warning"
                    >
                      Existant
                    </Badge>
                  ) : (
                    <Badge
                      key="badge"
                      severity="success"
                    >
                      Nouveau
                    </Badge>
                  ),
                  row.numero_ddecpp,
                  diffCell(row.nom_d_usage, existing?.nom_d_usage),
                  diffCell(row.address_ligne_1, existing?.address_ligne_1),
                  diffCell(row.code_postal, existing?.code_postal),
                  diffCell(row.ville, existing?.ville),
                  diffCell(row.siret, existing?.siret),
                  isModified ? (
                    <Checkbox
                      key="check"
                      className="mb-0! [&_.fr-fieldset\_\_element]:mb-0!"
                      options={[
                        {
                          label: 'Mettre à jour',
                          nativeInputProps: {
                            checked: selectedForUpdate.has(row.numero_ddecpp),
                            onChange: () => toggleUpdate(row.numero_ddecpp),
                          },
                        },
                      ]}
                    />
                  ) : (
                    'Créer'
                  ),
                ];
              })}
            />
          </div>

          <div className="flex gap-4">
            <Button
              onClick={handleImport}
              disabled={loading}
            >
              {loading ? 'Import en cours...' : `Importer (${displayedRows.length} CCG)`}
            </Button>
            <Button
              priority="secondary"
              onClick={reset}
              disabled={loading}
            >
              Annuler
            </Button>
          </div>
        </>
      )}

      {step === 'result' && result && (
        <div className="mb-8">
          <Alert
            severity="success"
            title="Import terminé"
            description={`${result.created} créé(s), ${result.updated} mis à jour, ${result.skipped} ignoré(s).`}
            className="mb-4"
          />
          <Button onClick={reset}>Nouvel import</Button>
        </div>
      )}
    </div>
  );
}
