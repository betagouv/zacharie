import { useCallback, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Table } from '@codegouvfr/react-dsfr/Table';
import { Alert } from '@codegouvfr/react-dsfr/Alert';
import { Badge } from '@codegouvfr/react-dsfr/Badge';
import { Checkbox } from '@codegouvfr/react-dsfr/Checkbox';
import { Stepper } from '@codegouvfr/react-dsfr/Stepper';
import type { LaboResultsImportResponse, LimsResultRow, LimsResultRowStatus } from '@api/src/types/responses';
import { importResultats, previewResultatsImport, type LimsImportRow } from '@app/services/laboratoire';
import { resultatAnalyseLabels, resultatBadgeSeverity } from '@app/utils/trichine';
import { computeImportRecap } from '@app/utils/trichine-import-recap';
import useDownloadFtpPdf from '@app/utils/download-ftp-pdf';

type Step = 'upload' | 'preview' | 'result';

type ImportResultData = LaboResultsImportResponse['data'];

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

const etapes: Record<Step, { numero: number; titre: string }> = {
  upload: { numero: 1, titre: 'Déposer le fichier' },
  preview: { numero: 2, titre: 'Vérifier ce que l’import va faire' },
  result: { numero: 3, titre: 'Compte rendu' },
};

function Resultat({ row }: { row: LimsResultRow }) {
  if (!row.resultat_analyse) {
    return <span className="text-gray-600">{row.raw_resultat ? `« ${row.raw_resultat} »` : '—'}</span>;
  }
  return (
    <Badge
      small
      noIcon
      severity={resultatBadgeSeverity(row.resultat_analyse)}
    >
      {resultatAnalyseLabels[row.resultat_analyse]}
    </Badge>
  );
}

// Tuile de chiffre clé : libellé au-dessus, valeur en grand
function Tuile({ label, valeur, accent }: { label: string; valeur: number; accent?: boolean }) {
  return (
    <div
      role="group"
      aria-label={label}
      className={`rounded p-4 ${
        accent
          ? 'bg-[var(--background-contrast-success)] text-[var(--text-default-success)]'
          : 'bg-[var(--background-alt-grey)]'
      }`}
    >
      <p className="fr-text--sm fr-mb-1v">{label}</p>
      <p className="fr-h3 fr-mb-0">{valeur}</p>
    </div>
  );
}

export default function LaboratoireResultsImport() {
  const [step, setStep] = useState<Step>('upload');
  const [rows, setRows] = useState<Array<LimsResultRow>>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ImportResultData | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [nomFichier, setNomFichier] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { isDownloading, onDownloadFtpPdf } = useDownloadFtpPdf('laboratoire');

  const matchedIndexes = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => row.status === 'matched');

  const deposer = useCallback(async (file: File | undefined) => {
    if (!file) return;
    setNomFichier(file.name);
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
  const fichesLnr = (result?.results ?? []).flatMap((line) =>
    line.ftp_confirmation ? [{ ...line.ftp_confirmation, reference_pool: line.reference_pool }] : []
  );

  return (
    <div className="py-4">
      <title>Importer des résultats | Laboratoire | Zacharie</title>
      <div className="fr-grid-row fr-grid-row-gutters fr-grid-row--center">
        <div className="fr-col-12 fr-col-md-11 p-4 md:p-0">
          <h1 className="fr-h3 fr-mb-3w">Importer des résultats d'analyse</h1>

          {error && (
            <Alert
              severity="error"
              title="Erreur"
              description={error}
              className="fr-mb-3w"
            />
          )}

          <div className="rounded bg-white p-6 md:p-10 md:shadow-sm">
            <Stepper
              currentStep={etapes[step].numero}
              stepCount={3}
              title={etapes[step].titre}
              nextTitle={
                step === 'upload'
                  ? etapes.preview.titre
                  : step === 'preview'
                    ? etapes.result.titre
                    : undefined
              }
            />

            {step === 'upload' && (
              <div className="grid gap-6 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
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
                  className={`flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed px-6 py-12 text-center ${
                    isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
                  }`}
                >
                  <span
                    className="fr-icon-upload-2-line fr-icon--lg text-[var(--text-action-high-blue-france)]"
                    aria-hidden="true"
                  />
                  <p className="fr-text--lg fr-mb-0 font-bold">
                    {loading ? 'Lecture du fichier…' : 'Glissez-déposez votre fichier CSV'}
                  </p>
                  <p className="fr-text--sm fr-mb-0 text-gray-600">ou</p>
                  <Button
                    type="button"
                    priority="secondary"
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
                  <p className="fr-text--xs fr-mb-0 text-gray-600">
                    Rien n'est enregistré avant votre validation
                  </p>
                </div>

                <div className="rounded-lg bg-[var(--background-alt-grey)] p-6">
                  <h2 className="fr-h6 fr-mb-2w">Le format attendu</h2>
                  <ul className="fr-text--sm fr-mb-3w space-y-2">
                    <li>Un fichier CSV encodé en UTF-8, séparateur « ; »</li>
                    <li>
                      Les colonnes <code>reference_pool</code> et <code>resultat_analyse</code>
                    </li>
                    <li>Des dates au format AAAA-MM-JJ</li>
                    <li>
                      Un pool désigné par sa référence Zacharie (<code>P-…</code>) ou par votre référence
                      interne
                    </li>
                  </ul>
                  <div className="flex flex-col gap-2">
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
                </div>
              </div>
            )}

            {step === 'preview' && (
              <>
                <div className="fr-mb-3w flex flex-wrap items-center justify-between gap-4">
                  <p className="fr-text--sm fr-mb-0 text-gray-700">
                    <span
                      className="fr-icon-file-line fr-icon--sm mr-1"
                      aria-hidden="true"
                    />
                    {nomFichier}
                  </p>
                  <Button
                    priority="tertiary no outline"
                    size="small"
                    iconId="fr-icon-refresh-line"
                    onClick={reset}
                    disabled={loading}
                  >
                    Changer de fichier
                  </Button>
                </div>

                <div className="fr-mb-4w grid grid-cols-2 gap-4 md:grid-cols-4">
                  <Tuile
                    label="À importer"
                    valeur={counts.matched}
                    accent
                  />
                  <Tuile
                    label="Déjà résolus"
                    valeur={counts.conflict}
                  />
                  <Tuile
                    label="Introuvables"
                    valeur={counts.unmatched}
                  />
                  <Tuile
                    label="Invalides"
                    valeur={counts.invalid}
                  />
                </div>

                {counts.matched === 0 ? (
                  <Alert
                    severity="info"
                    small
                    className="fr-mb-3w"
                    description="Aucune ligne importable dans ce fichier. Vérifiez les références de pool et les résultats."
                  />
                ) : (
                  <Checkbox
                    small
                    className="fr-mb-2w"
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

                <div className="overflow-x-auto">
                  <Table
                    fixed
                    noCaption
                    className="fr-mb-0 [&_td]:py-4! [&_td]:align-top"
                    headers={['Import', 'Statut', 'Pool', 'Résultat', 'Ce que l’import fait dans Zacharie']}
                    data={rows.map((row, index) => {
                      const importable = row.status === 'matched';
                      const estompe = importable ? '' : 'text-gray-500';
                      return [
                        importable ? (
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
                          noIcon
                          severity={statusMeta[row.status].severity}
                        >
                          {statusMeta[row.status].label}
                        </Badge>,
                        <span
                          key="pool"
                          className={importable ? 'font-bold' : estompe}
                        >
                          {row.reference_pool}
                        </span>,
                        <Resultat
                          key="resultat"
                          row={row}
                        />,
                        <div
                          key="detail"
                          className={`fr-text--sm fr-mb-0 ${estompe}`}
                        >
                          {row.message && <p className="fr-text--sm fr-mb-1w">{row.message}</p>}
                          {row.actions && (
                            <ul className="fr-mb-0 space-y-1 pl-4">
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
                      ];
                    })}
                  />
                </div>

                <div className="sticky bottom-0 z-10 -mx-6 mt-6 -mb-6 flex flex-col gap-4 rounded-b border-t border-gray-200 bg-white px-6 py-4 md:-mx-10 md:-mb-10 md:flex-row md:items-center md:px-10">
                  <div className="flex-1">
                    {selected.size > 0 ? (
                      <>
                        <h2 className="fr-text--md fr-mb-1v font-bold">
                          Si vous importez les {selected.size} ligne(s) cochée(s)
                        </h2>
                        <ul className="fr-text--sm fr-mb-0 flex flex-wrap gap-x-4 gap-y-1 text-gray-700 [&>li]:pb-0">
                          <li>{recap.pools} pool(s) reçoivent leur résultat</li>
                          {recap.carcasses.liberees > 0 && (
                            <li>{recap.carcasses.liberees} carcasse(s) libérée(s)</li>
                          )}
                          {recap.confirmationsLnr > 0 && (
                            <li>
                              {recap.confirmationsLnr} pool(s) transmis au LNR (
                              {recap.carcasses.en_attente_confirmation} carcasse(s) bloquée(s)), fiche à
                              joindre au colis
                            </li>
                          )}
                          {recap.carcasses.a_saisir > 0 && (
                            <li>{recap.carcasses.a_saisir} carcasse(s) à saisir</li>
                          )}
                          {recap.carcasses.decision_a_prendre > 0 && (
                            <li>
                              {recap.carcasses.decision_a_prendre} carcasse(s) en attente d’une décision
                            </li>
                          )}
                          {recap.ftpsCloturees.length > 0 && (
                            <li>Fiche(s) clôturée(s) : {recap.ftpsCloturees.join(', ')}</li>
                          )}
                          <li>Émetteurs prévenus par email</li>
                        </ul>
                      </>
                    ) : (
                      <p className="fr-text--sm fr-mb-0 text-gray-600">Cochez les lignes à importer</p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-4">
                    <Button
                      priority="secondary"
                      onClick={reset}
                      disabled={loading}
                    >
                      Annuler
                    </Button>
                    <Button
                      onClick={handleImport}
                      disabled={loading || selected.size === 0}
                    >
                      {loading ? 'Import en cours…' : `Importer ${selected.size} résultat(s)`}
                    </Button>
                  </div>
                </div>
              </>
            )}

            {step === 'result' && result && (
              <>
                <Alert
                  severity={result.errors > 0 ? 'warning' : 'success'}
                  title="Import terminé"
                  description={`${result.applied} appliqué(s), ${result.skipped} ignoré(s), ${result.errors} en erreur.`}
                  className="fr-mb-3w"
                />
                <div className="fr-mb-4w grid grid-cols-1 gap-4 md:grid-cols-3">
                  <Tuile
                    label="Appliqués"
                    valeur={result.applied}
                    accent
                  />
                  <Tuile
                    label="Ignorés"
                    valeur={result.skipped}
                  />
                  <Tuile
                    label="En erreur"
                    valeur={result.errors}
                  />
                </div>
                {fichesLnr.length > 0 && (
                  <div className="fr-mb-4w border-l-4 border-[var(--border-plain-warning)] bg-[var(--background-contrast-warning)] p-4 md:p-6">
                    <h2 className="fr-h6 fr-mb-1w">
                      {fichesLnr.length} fiche(s) de transmission à joindre aux colis envoyés au LNR
                    </h2>
                    <p className="fr-text--sm fr-mb-2w">
                      Un pool non négatif part au laboratoire national de référence avec sa fiche imprimée.
                    </p>
                    <ul className="fr-mb-0 space-y-2">
                      {fichesLnr.map((fiche) => (
                        <li
                          key={fiche.id}
                          className="flex flex-wrap items-center gap-x-4 gap-y-2 pb-0"
                        >
                          <span className="fr-text--sm fr-mb-0">
                            <Link to={`/app/laboratoire/ftp/${fiche.numero_fiche}`}>
                              {fiche.numero_fiche}
                            </Link>{' '}
                            — pool {fiche.reference_pool}
                          </span>
                          <Button
                            priority="secondary"
                            size="small"
                            iconId="fr-icon-download-line"
                            disabled={isDownloading}
                            onClick={() => onDownloadFtpPdf(fiche.id, fiche.numero_fiche)}
                          >
                            Télécharger la fiche
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {result.results.some((line) => !line.ok || line.avertissement) && (
                  <div className="fr-mb-4w overflow-x-auto">
                    <Table
                      noCaption
                      className="fr-mb-0"
                      headers={['Pool', 'Détail']}
                      data={result.results
                        .filter((line) => !line.ok || line.avertissement)
                        .map((line) => [line.reference_pool, line.error ?? line.avertissement ?? ''])}
                    />
                  </div>
                )}
                <Button
                  iconId="fr-icon-upload-line"
                  onClick={reset}
                >
                  Nouvel import
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
