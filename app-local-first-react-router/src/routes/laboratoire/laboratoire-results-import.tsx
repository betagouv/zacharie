import { useCallback, useRef, useState } from 'react';
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
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const matchedIndexes = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row.status === 'matched');

  const deposer = useCallback(async (file: File | undefined) => {
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
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div className="fr-col-12 fr-col-md-10 p-4 md:p-0">
          <h1 className="fr-h3 fr-mb-2w">Importer des résultats d'analyse</h1>

          {error && (
            <Alert
              severity="error"
              title="Erreur"
              description={error}
              className="fr-mb-2w"
            />
          )}

          {step === 'upload' && (
            <div className="rounded bg-white p-4 md:p-8 md:shadow-sm">
              <p className="fr-text--sm text-gray-700">
                Déposez un fichier <code>.csv</code> au format Zacharie. Les résultats sont rapprochés des
                pools par leur référence Zacharie (<code>P-…</code>) ou par votre référence interne. Avant
                d'enregistrer quoi que ce soit, Zacharie vous montre ce que l'import va faire, et vous
                choisissez les lignes à importer.
              </p>
              <div className="fr-mb-3w flex flex-wrap gap-x-6 gap-y-2">
                <Link
                  to="/app/laboratoire/results/format"
                  className="fr-link fr-icon-file-text-line fr-link--icon-left"
                >
                  Format du fichier à respecter
                </Link>
                <a
                  href="/modele-import-resultats-trichine.csv"
                  download
                  className="fr-link fr-icon-download-line fr-link--icon-left"
                >
                  Télécharger le modèle (CSV)
                </a>
              </div>
              <div
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setIsDragging(false);
                  if (!loading) deposer(event.dataTransfer.files[0]);
                }}
                className={`flex flex-col items-center gap-3 rounded border-2 border-dashed px-4 py-8 text-center ${
                  isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
                }`}
              >
                <span
                  className="fr-icon-upload-2-line text-gray-500"
                  aria-hidden="true"
                />
                <p className="fr-text--sm fr-mb-0 text-gray-700">
                  {loading ? 'Lecture du fichier…' : 'Glissez-déposez votre fichier CSV ici, ou :'}
                </p>
                <Button
                  type="button"
                  priority="secondary"
                  size="small"
                  disabled={loading}
                  onClick={() => inputRef.current?.click()}
                >
                  Choisir un fichier
                </Button>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(event) => {
                    deposer(event.target.files?.[0]);
                    // reset pour pouvoir redéposer le même fichier
                    event.target.value = '';
                  }}
                />
                <p className="fr-text--xs fr-mb-0 text-gray-600">CSV encodé en UTF-8, séparateur « ; »</p>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="rounded bg-white p-4 md:p-8 md:shadow-sm">
              <div className="fr-mb-2w flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge severity="success">{counts.matched} à importer</Badge>
                  {counts.conflict > 0 && <Badge severity="warning">{counts.conflict} déjà résolu(s)</Badge>}
                  {counts.unmatched > 0 && <Badge severity="info">{counts.unmatched} introuvable(s)</Badge>}
                  {counts.invalid > 0 && <Badge severity="error">{counts.invalid} invalide(s)</Badge>}
                </div>
                {counts.matched > 0 && (
                  <Checkbox
                    small
                    className="fr-mb-0 [&_.fr-fieldset\_\_element]:mb-0!"
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
                )}
              </div>

              {counts.matched === 0 && (
                <Alert
                  severity="info"
                  small
                  className="fr-mb-2w"
                  description="Aucune ligne importable dans ce fichier. Vérifiez les références de pool et les résultats."
                />
              )}

              <div className="fr-mb-3w overflow-x-auto">
                <Table
                  fixed
                  noCaption
                  className="fr-mb-0 [&_td]:align-top"
                  headers={[
                    'Import',
                    'Statut',
                    'Réf. pool',
                    'Résultat',
                    'Ce que l’import fait dans Zacharie',
                  ]}
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
                      small
                      severity={statusMeta[row.status].severity}
                    >
                      {statusMeta[row.status].label}
                    </Badge>,
                    row.reference_pool,
                    resultatLabel(row),
                    <div key="detail">
                      {row.message && <p className="fr-text--xs fr-mb-1v text-gray-700">{row.message}</p>}
                      {row.actions && (
                        <ul className="fr-text--xs fr-mb-0 space-y-1 pl-4">
                          {row.actions.map((action) => (
                            <li
                              key={action}
                              className="fr-pb-0"
                            >
                              {action}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>,
                  ])}
                />
              </div>

              <div className="flex flex-col gap-4 md:flex-row md:items-end">
                {selected.size > 0 && (
                  <div className="flex-1 border-l-4 border-[var(--border-plain-blue-france)] bg-[var(--background-alt-blue-france)] p-4">
                    <h2 className="fr-h6 fr-mb-1w">
                      Si vous importez les {selected.size} ligne(s) cochée(s)
                    </h2>
                    <ul className="fr-text--sm fr-mb-0">
                      <li>{recap.pools} pool(s) reçoivent leur résultat</li>
                      {recap.carcasses.liberees > 0 && (
                        <li>
                          {recap.carcasses.liberees} carcasse(s) libérée(s) côté trichine (résultat négatif)
                        </li>
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
                <div className="flex shrink-0 flex-wrap gap-4 md:ml-auto md:flex-col md:items-stretch">
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
              </div>
            </div>
          )}

          {step === 'result' && result && (
            <div className="rounded bg-white p-4 md:p-8 md:shadow-sm">
              <Alert
                severity={result.errors > 0 ? 'warning' : 'success'}
                title="Import terminé"
                description={`${result.applied} appliqué(s), ${result.skipped} ignoré(s), ${result.errors} en erreur.`}
                className="fr-mb-3w"
              />
              {result.results.some((line) => !line.ok || line.avertissement) && (
                <div className="fr-mb-3w overflow-x-auto">
                  <Table
                    noCaption
                    className="fr-mb-0"
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
      </div>
    </div>
  );
}
