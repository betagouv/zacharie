import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import dayjs from 'dayjs';
import { Input } from '@codegouvfr/react-dsfr/Input';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Badge } from '@codegouvfr/react-dsfr/Badge';
import { Table } from '@codegouvfr/react-dsfr/Table';
import type {
  AdminBugInvestigationsResponse,
  AdminNewBugInvestigationResponse,
} from '@api/src/types/responses';
import API from '@app/services/api';
import BugInvestigationStatusBadge from './bug-investigation-status-badge';

const MAX_IMAGES = 5;
const MAX_IMAGE_SIDE = 1600;

// on réduit les captures avant envoi : l'API limite le corps des requêtes à 5 Mo
function imageFileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(img.src);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export default function AdminBugResolutions() {
  const navigate = useNavigate();
  const [investigations, setInvestigations] = useState<
    AdminBugInvestigationsResponse['data']['investigations']
  >([]);
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<Array<string>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    API.get({ path: 'admin/bug-resolutions' })
      .then((res) => res as AdminBugInvestigationsResponse)
      .then((res) => {
        if (res.ok) setInvestigations(res.data.investigations);
      });
  }, []);

  async function addImageFiles(files: Array<File>) {
    const imageFiles = files.filter((file) => file.type.startsWith('image/'));
    if (!imageFiles.length) return;
    const dataUrls = await Promise.all(imageFiles.map(imageFileToDataUrl));
    setImages((current) => [...current, ...dataUrls].slice(0, MAX_IMAGES));
  }

  async function submit() {
    setIsSubmitting(true);
    setError('');
    const res = (await API.post({
      path: 'admin/bug-resolution',
      body: { description, images },
    })) as AdminNewBugInvestigationResponse;
    setIsSubmitting(false);
    if (!res.ok || !res.data) {
      setError(res.error || "L'enquête n'a pas pu être lancée");
      return;
    }
    navigate(`/app/admin/bug-resolution/${res.data.id}`);
  }

  return (
    <div className="p-2 md:p-4">
      <title>
        Résolution de bug | Admin | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire
      </title>
      <h1 className="fr-h3">Résolution de bug</h1>
      <p className="text-sm text-gray-600">
        Décrivez le dysfonctionnement ou collez une capture du ticket Notion. Albert enquête dans le code et
        la base de production, en lecture seule, puis propose un rapport et un plan d'action à faire valider
        par un développeur.
      </p>
      <div
        className="mb-8 bg-white p-4 md:p-8"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          addImageFiles(Array.from(event.dataTransfer.files));
        }}
      >
        <Input
          label="Description du problème"
          hintText="Collez une capture avec Ctrl+V / Cmd+V, ou glissez-déposez une image ici"
          textArea
          nativeTextAreaProps={{
            rows: 8,
            value: description,
            onChange: (event) => setDescription(event.target.value),
            onPaste: (event) => {
              const files = Array.from(event.clipboardData.files);
              if (files.length) {
                event.preventDefault();
                addImageFiles(files);
              }
            },
          }}
        />
        <div className="mb-4 flex flex-wrap items-center gap-4">
          {images.map((image, index) => (
            <div
              key={index}
              className="relative"
            >
              <img
                src={image}
                alt={`Capture ${index + 1}`}
                className="h-32 border border-gray-200 object-contain"
              />
              <Button
                type="button"
                size="small"
                priority="tertiary"
                iconId="fr-icon-delete-line"
                title="Retirer la capture"
                className="absolute top-1 right-1 bg-white"
                onClick={() => setImages((current) => current.filter((_, i) => i !== index))}
              />
            </div>
          ))}
          {images.length < MAX_IMAGES && (
            <label className="fr-btn fr-btn--secondary fr-btn--sm fr-icon-image-add-line fr-btn--icon-left">
              Ajouter une capture
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(event) => addImageFiles(Array.from(event.target.files ?? []))}
              />
            </label>
          )}
        </div>
        {error && <p className="fr-error-text">{error}</p>}
        <Button
          type="button"
          disabled={isSubmitting || (!description.trim() && !images.length)}
          onClick={submit}
        >
          {isSubmitting ? 'Lancement…' : "Lancer l'enquête"}
        </Button>
      </div>

      <h2 className="fr-h5">Enquêtes précédentes</h2>
      <Table
        fixed
        noCaption
        headers={['Date', 'Demandé par', 'Description', 'Statut']}
        data={investigations.map((investigation) => [
          <Link
            key="date"
            to={`/app/admin/bug-resolution/${investigation.id}`}
          >
            {dayjs(investigation.created_at).format('DD/MM/YYYY HH:mm')}
          </Link>,
          `${investigation.User.prenom ?? ''} ${investigation.User.nom_de_famille ?? ''}`,
          investigation.description.length > 120
            ? `${investigation.description.slice(0, 120)}…`
            : investigation.description,
          <BugInvestigationStatusBadge
            key="status"
            status={investigation.status}
          />,
        ])}
      />
      {!investigations.length && <Badge severity="info">Aucune enquête pour l'instant</Badge>}
    </div>
  );
}
