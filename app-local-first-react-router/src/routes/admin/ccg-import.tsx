import { useState, useCallback } from 'react';
import { read, utils } from '@e965/xlsx';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Table } from '@codegouvfr/react-dsfr/Table';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import { Badge } from '@codegouvfr/react-dsfr/Badge';
import { Checkbox } from '@codegouvfr/react-dsfr/Checkbox';
import API from '@app/services/api';
import type { AdminCcgCheckDuplicatesResponse, AdminCcgImportResponse } from '@api/src/types/responses';

interface CcgRow {
  numero_ddecpp: string;
  nom_d_usage: string;
  address_ligne_1: string;
  address_ligne_2: string;
  code_postal: string;
  ville: string;
  siret: string;
}

type Step = 'upload' | 'preview' | 'result';

export default function CcgImport() {
  const [step, setStep] = useState<Step>('upload');
  const [rows, setRows] = useState<CcgRow[]>([]);
  const [duplicates, setDuplicates] = useState<Set<string>>(new Set());
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

      // Find the first matching key from a list of candidates
      const col = (row: Record<string, string>, ...keys: string[]) => {
        for (const k of keys) {
          if (k in row) return String(row[k]).trim();
        }
        return '';
      };

      const mapped: CcgRow[] = jsonRows.map((row) => ({
        numero_ddecpp: col(
          row,
          'Unité Activité (UA) : Identifier métier (Type : Valorisation)',
          'numero_ddecpp',
          'Numéro DDECPP',
        ),
        nom_d_usage: col(
          row,
          'Établissement : Enseigne usuelle\n(RESYTAL)',
          'Établissement : Enseigne usuelle (RESYTAL)',
          'nom_d_usage',
          'raison_sociale',
          'Raison sociale',
        ),
        address_ligne_1: col(
          row,
          'Établissement : Adresse postale :\nConcaténations des lignes adresses 1, 2 & 3',
          'Établissement : Adresse postale : Concaténations des lignes adresses 1, 2 & 3',
          'address_ligne_1',
          'Adresse',
        ),
        address_ligne_2: '',
        code_postal: col(
          row,
          'Établissement : Adresse postale:\nCode postal',
          'Établissement : Adresse postale: Code postal',
          'code_postal',
          'Code postal',
        ),
        ville: col(
          row,
          'Établissement : Adresse postale:\nBureau distributeur',
          'Établissement : Adresse postale: Bureau distributeur',
          'ville',
          'Ville',
        ),
        siret: col(row, 'Établissement : SIRET/NUMAGRIT', 'siret', 'SIRET'),
      }));

      const validRows = mapped.filter((r) => r.numero_ddecpp);
      if (validRows.length === 0) {
        setError("Aucune ligne avec un numero_ddecpp n'a été trouvée. Vérifiez les colonnes du fichier.");
        setLoading(false);
        return;
      }

      const numeroDdecpps = validRows.map((r) => r.numero_ddecpp);
      const response = (await API.post({
        path: 'admin/ccg/check-duplicates',
        body: { numero_ddecpps: numeroDdecpps },
      })) as AdminCcgCheckDuplicatesResponse;

      if (!response.ok) {
        setError(response.error || 'Erreur lors de la vérification des doublons.');
        setLoading(false);
        return;
      }

      const dupes = new Set(response.data.duplicates);
      setRows(validRows);
      setDuplicates(dupes);
      setSelectedForUpdate(new Set(dupes));
      setStep('preview');
    } catch {
      setError("Erreur lors de la lecture du fichier. Vérifiez qu'il s'agit d'un fichier CSV ou Excel valide.");
    } finally {
      setLoading(false);
    }
  }, []);

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
        setSelectedForUpdate(new Set(duplicates));
      } else {
        setSelectedForUpdate(new Set());
      }
    },
    [duplicates],
  );

  const handleImport = useCallback(async () => {
    setLoading(true);
    setError('');

    const ccgs = rows.map((row) => {
      const isDuplicate = duplicates.has(row.numero_ddecpp);
      let action: 'create' | 'update' | 'skip';
      if (!isDuplicate) {
        action = 'create';
      } else if (selectedForUpdate.has(row.numero_ddecpp)) {
        action = 'update';
      } else {
        action = 'skip';
      }
      return { ...row, action };
    });

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
  }, [rows, duplicates, selectedForUpdate]);

  const reset = useCallback(() => {
    setStep('upload');
    setRows([]);
    setDuplicates(new Set());
    setSelectedForUpdate(new Set());
    setResult(null);
    setError('');
  }, []);

  const existingCount = rows.filter((r) => duplicates.has(r.numero_ddecpp)).length;

  return (
    <div className="fr-container p-4 md:p-8">
      <title>Import CCG | Admin | Zacharie</title>
      <h1>Importer des CCG depuis un fichier CSV/XLS</h1>

      {error && <Alert severity="error" title="Erreur" description={error} className="mb-4" />}

      {step === 'upload' && (
        <div className="mb-8">
          <p className="mb-4">
            Sélectionnez un fichier Excel CCG (format RESYTAL, en-têtes en ligne 5). Les colonnes utilisées
            sont&nbsp;: <code>Unité Activité (UA) : Identifier métier</code>,{' '}
            <code>Établissement : Enseigne usuelle</code>, <code>Adresse postale</code>,{' '}
            <code>Code postal</code>, <code>Bureau distributeur</code>, <code>SIRET/NUMAGRIT</code>
          </p>
          <input
            type="file"
            accept=".csv,.xls,.xlsx"
            onChange={handleFileChange}
            disabled={loading}
            className="fr-input"
          />
          {loading && <p className="mt-2">Chargement...</p>}
        </div>
      )}

      {step === 'preview' && (
        <>
          <div className="mb-4 flex items-center gap-4">
            <Badge severity="success">{rows.length - existingCount} nouveau(x)</Badge>
            <Badge severity="warning">{existingCount} existant(s)</Badge>
          </div>

          {existingCount > 0 && (
            <div className="mb-4">
              <Checkbox
                options={[
                  {
                    label: `Mettre à jour tous les existants (${existingCount})`,
                    nativeInputProps: {
                      checked: selectedForUpdate.size === duplicates.size,
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
              data={rows.map((row) => {
                const isDuplicate = duplicates.has(row.numero_ddecpp);
                return [
                  isDuplicate ? (
                    <Badge key="badge" severity="warning">
                      Existant
                    </Badge>
                  ) : (
                    <Badge key="badge" severity="success">
                      Nouveau
                    </Badge>
                  ),
                  row.numero_ddecpp,
                  row.nom_d_usage,
                  row.address_ligne_1,
                  row.code_postal,
                  row.ville,
                  row.siret,
                  isDuplicate ? (
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
            <Button onClick={handleImport} disabled={loading}>
              {loading ? 'Import en cours...' : `Importer (${rows.length} CCG)`}
            </Button>
            <Button priority="secondary" onClick={reset} disabled={loading}>
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
