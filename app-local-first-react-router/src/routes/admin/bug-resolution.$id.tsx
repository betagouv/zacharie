import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import dayjs from 'dayjs';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { BugInvestigationStatus } from '@prisma/client';
import type { AdminBugInvestigationResponse } from '@api/src/types/responses';
import API from '@app/services/api';
import Chargement from '@app/components/Chargement';
import BugInvestigationStatusBadge from './bug-investigation-status-badge';

type Investigation = NonNullable<AdminBugInvestigationResponse['data']>['investigation'];

const POLLING_INTERVAL_MS = 3000;

const toolLabels: Record<string, string> = {
  query_db: 'Requête SQL',
  search_code: 'Recherche dans le code',
  read_file: 'Lecture de fichier',
  list_dir: 'Lecture de dossier',
  list_commits: 'Derniers commits',
};

function formatToolArgs(args: string) {
  try {
    const parsed = JSON.parse(args) as Record<string, unknown>;
    return Object.values(parsed).join(' · ');
  } catch {
    return args;
  }
}

export default function AdminBugResolution() {
  const params = useParams<{ id: string }>();
  const [investigation, setInvestigation] = useState<Investigation | null>(null);
  const [copied, setCopied] = useState(false);

  const isRunning = !investigation || investigation.status === BugInvestigationStatus.EN_COURS;

  useEffect(() => {
    if (!isRunning) return;
    let cancelled = false;
    const load = () =>
      API.get({ path: `admin/bug-resolution/${params.id}` })
        .then((res) => res as AdminBugInvestigationResponse)
        .then((res) => {
          if (!cancelled && res.ok && res.data) setInvestigation(res.data.investigation);
        });
    load();
    const interval = window.setInterval(load, POLLING_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [params.id, isRunning]);

  if (!investigation) return <Chargement />;

  return (
    <div className="p-2 md:p-4">
      <title>
        Résolution de bug | Admin | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire
      </title>
      <Link
        to="/app/admin/bug-resolution"
        className="fr-link fr-icon-arrow-left-line fr-link--icon-left"
      >
        Toutes les enquêtes
      </Link>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <h1 className="fr-h3 mb-0">
          Enquête du {dayjs(investigation.created_at).format('DD/MM/YYYY à HH:mm')}
        </h1>
        <BugInvestigationStatusBadge status={investigation.status} />
      </div>
      <p className="text-sm text-gray-600">
        Demandée par {investigation.User.prenom} {investigation.User.nom_de_famille}
      </p>

      <section className="mb-6 bg-white p-4 md:p-8">
        <h2 className="fr-h6">Description</h2>
        <p className="whitespace-pre-wrap">{investigation.description}</p>
        <div className="flex flex-wrap gap-4">
          {investigation.images.map((image, index) => (
            <a
              key={index}
              href={image}
              target="_blank"
              rel="noopener noreferrer"
              style={{ backgroundImage: 'none' }}
            >
              <img
                src={image}
                alt={`Capture ${index + 1}`}
                className="h-32 border border-gray-200 object-contain"
              />
            </a>
          ))}
        </div>
      </section>

      {investigation.status === BugInvestigationStatus.ERREUR && (
        <div className="fr-alert fr-alert--error mb-6">
          <p>{investigation.error}</p>
        </div>
      )}

      {investigation.report && (
        <section className="mb-6 bg-white p-4 md:p-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="fr-h6 mb-0">Rapport d'Albert</h2>
            <Button
              type="button"
              size="small"
              priority="secondary"
              iconId="fr-icon-clipboard-line"
              onClick={() => {
                navigator.clipboard.writeText(investigation.report ?? '');
                setCopied(true);
              }}
            >
              {copied ? 'Copié' : 'Copier le rapport (Markdown)'}
            </Button>
          </div>
          <p className="text-sm text-gray-600">
            Rapport généré par une IA : vérifiez chaque preuve avant d'agir. Aucun code ni aucune donnée n'a
            été modifié.
          </p>
          <div className="whitespace-pre-wrap">{investigation.report}</div>
        </section>
      )}

      <section className="bg-white p-4 md:p-8">
        <h2 className="fr-h6">
          Étapes de l'enquête ({investigation.steps.filter((step) => step.type === 'tool').length})
        </h2>
        {isRunning && (
          <p className="text-sm text-gray-600">Albert enquête… la page se met à jour toute seule.</p>
        )}
        <ol className="flex flex-col gap-2">
          {investigation.steps.map((step, index) =>
            step.type === 'message' ? (
              <li
                key={index}
                className="text-sm whitespace-pre-wrap italic"
              >
                {step.content}
              </li>
            ) : (
              <li key={index}>
                <details>
                  <summary className="cursor-pointer text-sm">
                    <strong>{toolLabels[step.tool] ?? step.tool}</strong> : {formatToolArgs(step.args)}
                  </summary>
                  <pre className="mt-2 max-h-96 overflow-auto bg-gray-100 p-2 text-xs whitespace-pre-wrap">
                    {step.result}
                  </pre>
                </details>
              </li>
            )
          )}
        </ol>
      </section>
    </div>
  );
}
