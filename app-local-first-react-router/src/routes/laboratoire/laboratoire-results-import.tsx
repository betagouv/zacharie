import { useCallback, useState } from 'react';
import { Link } from 'react-router';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Table } from '@codegouvfr/react-dsfr/Table';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import { Badge } from '@codegouvfr/react-dsfr/Badge';
import { Checkbox } from '@codegouvfr/react-dsfr/Checkbox';
import type { LimsResultRow, LimsResultRowStatus } from '@api/src/types/responses';
import { importResultats, previewResultatsImport, type LimsImportRow } from '@app/services/laboratoire';
import { resultatAnalyseLabels } from '@app/utils/trichine';
import { computeImportRecap } from '@app/utils/trichine-import-recap';

type Step = 'upload' | 'preview' | 'result';

type ImportResultData = {
  applied: number;
  skipped: number;
  errors: number;
  results: Array<{ reference_pool: string; ok: boolean; error?: string; avertissement?: string }>;
};

const statusMeta: Record<
  LimsResultRowStatus,
  { severity: 'success' | 'warning' | 'info' | 'error'; label: string }
> = {
  matched: { severity: 'success', label: 'À importer' },
  conflict: { severity: 'warning', label: 'Déjà résolu' },
  unmatched: { severity: 'info', label: 'Introuvable' },
  invalid: { severity: 'error', label: 'Invalide' },
};

// Lit le fichier et renvoie son contenu encodé en base64 (sans le préfixe data:).
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function resultatLabel(row: LimsResultRow): string {
  if (row.resultat_analyse) return resultatAnalyseLabels[row.resultat_analyse];
  return row.raw_resultat ? `« ${row.raw_resultat} »` : '—';
}

export default function LaboratoireResultsImport() {
  const [step, setStep] = useState<Step>('upload');
  const [rows, setRows] = useState<Array<LimsResultRow>>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ImportResultData | null>(null);

  const matchedIndexes = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row.status === 'matched');

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    setLoading(true);
    try {
      const content = await fileToBase64(file);
      const response = await previewResultatsImport({ filename: file.name, content });
      if (!response.ok || !response.data) {
        setError(response.error || 'Erreur lors de la lecture du fichier.');
        return;
      }
      const previewRows = response.data.rows;
      setRows(previewRows);
      // Par défaut, on sélectionne toutes les lignes importables
      setSelected(
        new Set(
          previewRows.map((row, index) => (row.status === 'matched' ? index : -1)).filter((i) => i >= 0)
        )
      );
      setStep('preview');
    } catch {
      setError("Erreur lors de la lecture du fichier. Vérifiez qu'il s'agit d'un CSV valide.");
    } finally {
      setLoading(false);
      // reset input pour pouvoir re-uploader le même fichier
      event.target.value = '';
    }
  }, []);

  const toggle = useCallback((index: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const toggleAll = useCallback(
    (checked: boolean) => {
      setSelected(checked ? new Set(matchedIndexes.map(({ index }) => index)) : new Set());
    },
    // matchedIndexes est dérivé de rows
    [rows] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const handleImport = useCallback(async () => {
    setLoading(true);
    setError('');
    const toImport: Array<LimsImportRow> = rows
      .filter((row, index) => row.status === 'matched' && row.resultat_analyse && selected.has(index))
      .map((row) => ({
        reference_pool: row.reference_pool,
        resultat_analyse: row.resultat_analyse!,
        parasite_identifie: row.parasite_identifie,
        date_debut_analyse: row.date_debut_analyse,
        date_fin_analyse: row.date_fin_analyse,
        reference_labo: row.reference_labo,
        commentaire: row.commentaire,
      }));
    try {
      const response = await importResultats(toImport);
      if (!response.ok || !response.data) {
        setError(response.error || "Erreur lors de l'import.");
        return;
      }
      setResult(response.data);
      setStep('result');
    } catch {
      setError("Erreur lors de l'import des résultats.");
    } finally {
      setLoading(false);
    }
  }, [rows, selected]);

  const reset = useCallback(() => {
    setStep('upload');
    setRows([]);
    setSelected(new Set());
    setResult(null);
    setError('');
  }, []);

  const counts = rows.reduce(
    (acc, row) => {
      acc[row.status]++;
      return acc;
    },
    { matched: 0, conflict: 0, unmatched: 0, invalid: 0 } as Record<LimsResultRowStatus, number>
  );
  const recap = computeImportRecap(
    rows.filter((row, index) => row.status === 'matched' && selected.has(index))
  );

  return (
    <div className="py-4">
      <title>Importer des résultats | Laboratoire | Zacharie</title>
      <h1 className="fr-h3">Importer des résultats d'analyse</h1>

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
            Déposez un fichier <code>.csv</code> au format Zacharie. Les résultats sont rapprochés des pools
            par leur référence Zacharie (<code>P-…</code>) ou par votre référence interne. Avant d'enregistrer
            quoi que ce soit, Zacharie vous montre ce que l'import va faire, et vous choisissez les lignes à
            importer.
          </p>
          <ul className="mb-4">
            <li>
              <Link to="/app/laboratoire/results/format">Format du fichier à respecter</Link>
            </li>
            <li>
              <a
                href="/modele-import-resultats-trichine.csv"
                download
              >
                Télécharger le modèle (CSV)
              </a>
            </li>
          </ul>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            disabled={loading}
            className="fr-input"
          />
          {loading && <p className="mt-2">Lecture du fichier…</p>}
        </div>
      )}

      {step === 'preview' && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Badge severity="success">{counts.matched} à importer</Badge>
            {counts.conflict > 0 && <Badge severity="warning">{counts.conflict} déjà résolu(s)</Badge>}
            {counts.unmatched > 0 && <Badge severity="info">{counts.unmatched} introuvable(s)</Badge>}
            {counts.invalid > 0 && <Badge severity="error">{counts.invalid} invalide(s)</Badge>}
          </div>

          {counts.matched === 0 ? (
            <Alert
              severity="info"
              small
              className="mb-4"
              description="Aucune ligne importable dans ce fichier. Vérifiez les références de pool et les résultats."
            />
          ) : (
            <div className="mb-4">
              <Checkbox
                options={[
                  {
                    label: `Tout importer (${matchedIndexes.length})`,
                    nativeInputProps: {
                      checked: selected.size === matchedIndexes.length && matchedIndexes.length > 0,
                      onChange: (e) => toggleAll(e.target.checked),
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
              headers={['Import', 'Statut', 'Réf. pool', 'Résultat', 'Ce que l’import fait dans Zacharie']}
              data={rows.map((row, index) => [
                row.status === 'matched' ? (
                  <Checkbox
                    key="check"
                    className="mb-0! [&_.fr-fieldset\_\_element]:mb-0!"
                    options={[
                      {
                        label: '',
                        nativeInputProps: {
                          checked: selected.has(index),
                          onChange: () => toggle(index),
                        },
                      },
                    ]}
                  />
                ) : (
                  ''
                ),
                <Badge
                  key="badge"
                  severity={statusMeta[row.status].severity}
                >
                  {statusMeta[row.status].label}
                </Badge>,
                row.reference_pool,
                resultatLabel(row),
                <div key="detail">
                  {row.message && <p className="mb-1 text-sm">{row.message}</p>}
                  {row.actions && (
                    <ul className="mb-0 text-sm">
                      {row.actions.map((action) => (
                        <li key={action}>{action}</li>
                      ))}
                    </ul>
                  )}
                </div>,
              ])}
            />
          </div>
          {selected.size > 0 && (
            <div className="mb-4 bg-[var(--background-alt-blue-france)] p-4">
              <h2 className="fr-h6 mb-2">Si vous importez les {selected.size} ligne(s) cochée(s)</h2>
              <ul className="mb-0">
                <li>{recap.pools} pool(s) reçoivent leur résultat</li>
                {recap.carcasses.liberees > 0 && (
                  <li>{recap.carcasses.liberees} carcasse(s) libérée(s) côté trichine (résultat négatif)</li>
                )}
                {recap.confirmationsLnr > 0 && (
                  <li>
                    {recap.confirmationsLnr} pool(s) transmis au LNR pour confirmation (
                    {recap.carcasses.en_attente_confirmation} carcasse(s) bloquée(s)) : une fiche de
                    transmission par pool, à imprimer et joindre au colis
                  </li>
                )}
                {recap.carcasses.a_saisir > 0 && (
                  <li>{recap.carcasses.a_saisir} carcasse(s) à saisir (trichine confirmée)</li>
                )}
                {recap.carcasses.decision_a_prendre > 0 && (
                  <li>
                    {recap.carcasses.decision_a_prendre} carcasse(s) en attente d’une décision (parasite
                    détecté)
                  </li>
                )}
                {recap.ftpsCloturees.length > 0 && (
                  <li>Fiche(s) de transmission clôturée(s) : {recap.ftpsCloturees.join(', ')}</li>
                )}
                <li>Les émetteurs concernés sont prévenus par email</li>
              </ul>
            </div>
          )}

          <div className="flex flex-wrap gap-4">
            <Button
              onClick={handleImport}
              disabled={loading || selected.size === 0}
            >
              {loading ? 'Import en cours…' : `Importer ${selected.size} résultat(s)`}
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
            severity={result.errors > 0 ? 'warning' : 'success'}
            title="Import terminé"
            description={`${result.applied} appliqué(s), ${result.skipped} ignoré(s), ${result.errors} en erreur.`}
            className="mb-4"
          />
          {result.results.some((line) => !line.ok || line.avertissement) && (
            <div className="mb-4 overflow-x-auto">
              <Table
                noCaption
                headers={['Réf. pool', 'Détail']}
                data={result.results
                  .filter((line) => !line.ok || line.avertissement)
                  .map((line) => [line.reference_pool, line.error ?? line.avertissement ?? ''])}
              />
            </div>
          )}
          <Button onClick={reset}>Nouvel import</Button>
        </div>
      )}
    </div>
  );
}
