import { useState, useCallback, useRef } from 'react';
import { read } from '@e965/xlsx';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Table } from '@codegouvfr/react-dsfr/Table';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import { Badge } from '@codegouvfr/react-dsfr/Badge';
import API from '@app/services/api';
import { parsePremiersDetenteursSheet } from '@app/utils/parse-premiers-detenteurs-sheet';
import type {
  AdminPremiersDetenteursPreviewResponse,
  AdminPremiersDetenteursImportResponse,
  PremierDetenteurImportRow,
} from '@api/src/types/responses';

type Step = 'upload' | 'preview' | 'result';

export default function PremiersDetenteursImport() {
  const [step, setStep] = useState<Step>('upload');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [nouveaux, setNouveaux] = useState<PremierDetenteurImportRow[]>([]);
  const [existants, setExistants] = useState<PremierDetenteurImportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // on vide l'input pour pouvoir choisir à nouveau le même fichier après une erreur
    e.target.value = '';
    if (!file) return;

    setError('');
    setLoading(true);

    try {
      const workbook = read(await file.arrayBuffer());
      const rows = parsePremiersDetenteursSheet(workbook.Sheets[workbook.SheetNames[0]]);
      if (rows.length === 0) {
        setError("Aucune ligne avec une raison sociale n'a été trouvée. Vérifiez les colonnes du fichier.");
        return;
      }

      const response = (await API.post({
        path: 'admin/premiers-detenteurs/preview',
        body: { premiers_detenteurs: rows },
      })) as AdminPremiersDetenteursPreviewResponse;

      if (!response.ok) {
        setError(response.error || 'Erreur lors de la vérification.');
        return;
      }

      setNouveaux(response.data.nouveaux);
      setExistants(response.data.existants);
      setStep('preview');
    } catch {
      setError(
        "Erreur lors de la lecture du fichier. Vérifiez qu'il s'agit d'un fichier CSV ou Excel valide."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const handleImport = useCallback(async () => {
    setLoading(true);
    setError('');

    const response = (await API.post({
      path: 'admin/premiers-detenteurs/import',
      // on envoie aussi les existants : le serveur les ignore et les compte
      body: { premiers_detenteurs: [...nouveaux, ...existants] },
    })) as AdminPremiersDetenteursImportResponse;

    setLoading(false);
    if (!response.ok) {
      setError(response.error || "Erreur lors de l'import.");
      return;
    }
    setResult(response.data);
    setStep('result');
  }, [nouveaux, existants]);

  const reset = useCallback(() => {
    setStep('upload');
    setNouveaux([]);
    setExistants([]);
    setResult(null);
    setError('');
  }, []);

  return (
    <div className="fr-container p-4 md:p-8">
      <title>Import premiers détenteurs | Admin | Zacharie</title>
      <h1>Importer des premiers détenteurs depuis un fichier CSV/XLS</h1>

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
            Sélectionnez un fichier d'associations de chasse (sociétés, ACCA…). Les colonnes utilisées
            sont&nbsp;: <code>Raison sociale</code>, <code>Code postal</code>, <code>Commune</code>. Le
            premier chasseur qui rejoint une association importée en devient l'administrateur.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xls,.xlsx"
            onChange={handleFileChange}
            disabled={loading}
            className="hidden"
            aria-label="Fichier des premiers détenteurs"
          />
          <Button
            iconId="fr-icon-upload-line"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
          >
            Choisir un fichier
          </Button>
          {loading && <p className="mt-2">Chargement...</p>}
        </div>
      )}

      {step === 'preview' && (
        <>
          <div className="mb-4 flex gap-4">
            <Button
              onClick={handleImport}
              disabled={loading || nouveaux.length === 0}
            >
              {loading ? 'Import en cours...' : `Importer (${nouveaux.length} premier(s) détenteur(s))`}
            </Button>
            <Button
              priority="secondary"
              onClick={reset}
              disabled={loading}
            >
              Annuler
            </Button>
          </div>

          <div className="mb-4 flex items-center gap-4">
            <Badge severity="success">{nouveaux.length} nouveau(x)</Badge>
            <Badge severity="info">{existants.length} déjà enregistré(s) (ignorés)</Badge>
          </div>

          <div className="mb-4 overflow-x-auto">
            <Table
              fixed
              noCaption
              className="[&_td]:align-middle"
              headers={['Statut', 'Raison sociale', 'Code postal', 'Commune']}
              data={[
                ...nouveaux.map((row) => [
                  <Badge
                    key="badge"
                    severity="success"
                  >
                    Nouveau
                  </Badge>,
                  row.raison_sociale,
                  row.code_postal,
                  row.ville,
                ]),
                ...existants.map((row) => [
                  <Badge
                    key="badge"
                    severity="info"
                  >
                    Déjà enregistré
                  </Badge>,
                  row.raison_sociale,
                  row.code_postal,
                  row.ville,
                ]),
              ]}
            />
          </div>
        </>
      )}

      {step === 'result' && result && (
        <div className="mb-8">
          <Alert
            severity="success"
            title="Import terminé"
            description={`${result.created} créé(s), ${result.skipped} déjà enregistré(s).`}
            className="mb-4"
          />
          <Button onClick={reset}>Nouvel import</Button>
        </div>
      )}
    </div>
  );
}
