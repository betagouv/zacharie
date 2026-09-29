import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import dayjs from 'dayjs';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@codegouvfr/react-dsfr/Button';
import { Table } from '@codegouvfr/react-dsfr/Table';
import { BugInvestigationStatus } from '@prisma/client';
import type {
  AdminBugInvestigationResponse,
  AdminBugInvestigationsResponse,
  AdminNewBugInvestigationResponse,
} from '@api/src/types/responses';
import type {
  AlbertToolCall,
  BugInvestigationMessage,
  BugInvestigationUserMessage,
} from '@api/src/types/bug-investigation';
import API from '@app/services/api';
import Chargement from '@app/components/Chargement';
import BugInvestigationStatusBadge from './bug-investigation-status-badge';

type Conversation = NonNullable<AdminBugInvestigationResponse['data']>['investigation'];

const POLLING_INTERVAL_MS = 3000;
const MAX_IMAGES = 5;
const MAX_IMAGE_SIDE = 1600;

const toolLabels: Record<string, string> = {
  query_db: 'Requête SQL',
  fei_timeline: 'Chronologie de la fiche',
  describe_tables: 'Structure des tables',
  search_code: 'Recherche dans le code',
  read_file: 'Lecture de fichier',
  list_dir: 'Lecture de dossier',
  list_commits: 'Derniers commits',
};

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

function formatToolArgs(args: string) {
  try {
    return Object.values(JSON.parse(args) as Record<string, unknown>).join(' · ');
  } catch {
    return args;
  }
}

type AlbertPart =
  | { kind: 'text'; text: string; isFinal: boolean }
  | { kind: 'tool'; call: AlbertToolCall; result: string | null };

type ThreadBlock =
  | { author: 'user'; message: BugInvestigationUserMessage }
  | { author: 'albert'; parts: Array<AlbertPart> };

// regroupe les messages successifs d'Albert (appels d'outils + réponse) en un seul bloc
function buildThread(messages: Array<BugInvestigationMessage>): Array<ThreadBlock> {
  const toolResults = new Map<string, string>();
  for (const message of messages) {
    if (message.role === 'tool') toolResults.set(message.tool_call_id, message.content);
  }
  const blocks: Array<ThreadBlock> = [];
  for (const message of messages) {
    if (message.role === 'user') {
      blocks.push({ author: 'user', message });
      continue;
    }
    if (message.role !== 'assistant') continue;
    let block = blocks.at(-1);
    if (block?.author !== 'albert') {
      block = { author: 'albert', parts: [] };
      blocks.push(block);
    }
    if (message.content?.trim()) {
      block.parts.push({ kind: 'text', text: message.content.trim(), isFinal: !message.tool_calls?.length });
    }
    for (const call of message.tool_calls ?? []) {
      block.parts.push({ kind: 'tool', call, result: toolResults.get(call.id) ?? null });
    }
  }
  return blocks;
}

function UserMessageContent({ message }: { message: BugInvestigationUserMessage }) {
  const parts =
    typeof message.content === 'string'
      ? [{ type: 'text' as const, text: message.content }]
      : message.content;
  return (
    <>
      {parts.map((part, index) =>
        part.type === 'text' ? (
          <p
            key={index}
            className="mb-2 whitespace-pre-wrap"
          >
            {part.text}
          </p>
        ) : (
          <a
            key={index}
            href={part.image_url.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ backgroundImage: 'none' }}
            className="mr-2 inline-block"
          >
            <img
              src={part.image_url.url}
              alt={`Capture ${index + 1}`}
              className="h-32 border border-gray-200 object-contain"
            />
          </a>
        )
      )}
      {!!message.image_descriptions?.length && (
        <details className="mt-2 text-sm text-gray-600">
          <summary className="cursor-pointer">Ce qu'Albert a lu dans les captures</summary>
          {message.image_descriptions.map((description, index) => (
            <pre
              key={index}
              className="mt-1 max-h-96 overflow-auto bg-gray-100 p-2 text-xs whitespace-pre-wrap"
            >
              {description}
            </pre>
          ))}
        </details>
      )}
    </>
  );
}

function AlbertAnswer({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <div className="[&_code]:bg-gray-100 [&_code]:px-1 [&_code]:text-sm [&_h1]:text-xl [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-lg [&_h3]:mt-3 [&_h3]:mb-1 [&_h3]:text-base [&_pre]:mb-3 [&_pre]:overflow-auto [&_pre]:bg-gray-100 [&_pre]:p-2 [&_pre_code]:px-0 [&_table]:mb-3 [&_td]:border [&_td]:border-gray-200 [&_td]:p-1 [&_th]:border [&_th]:border-gray-200 [&_th]:p-1">
        <Markdown remarkPlugins={[remarkGfm]}>{text}</Markdown>
      </div>
      <Button
        type="button"
        size="small"
        priority="tertiary no outline"
        iconId="fr-icon-clipboard-line"
        onClick={() => {
          navigator.clipboard.writeText(text);
          setCopied(true);
        }}
      >
        {copied ? 'Copié' : 'Copier'}
      </Button>
    </div>
  );
}

function Composer({
  disabled,
  onSend,
  placeholder,
}: {
  disabled: boolean;
  onSend: (content: string, images: Array<string>) => Promise<boolean>;
  placeholder: string;
}) {
  const [content, setContent] = useState('');
  const [images, setImages] = useState<Array<string>>([]);
  const [isSending, setIsSending] = useState(false);
  const canSend = !disabled && !isSending && (!!content.trim() || images.length > 0);

  async function addImageFiles(files: Array<File>) {
    const imageFiles = files.filter((file) => file.type.startsWith('image/'));
    if (!imageFiles.length) return;
    const dataUrls = await Promise.all(imageFiles.map(imageFileToDataUrl));
    setImages((current) => [...current, ...dataUrls].slice(0, MAX_IMAGES));
  }

  async function send() {
    if (!canSend) return;
    setIsSending(true);
    const sent = await onSend(content, images);
    setIsSending(false);
    if (sent) {
      setContent('');
      setImages([]);
    }
  }

  return (
    <div
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        addImageFiles(Array.from(event.dataTransfer.files));
      }}
    >
      {images.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {images.map((image, index) => (
            <div
              key={index}
              className="relative"
            >
              <img
                src={image}
                alt={`Capture ${index + 1}`}
                className="h-20 border border-gray-200 object-contain"
              />
              <button
                type="button"
                className="fr-icon-close-line fr-icon--sm absolute top-0 right-0 bg-white"
                title="Retirer la capture"
                aria-label="Retirer la capture"
                onClick={() => setImages((current) => current.filter((_, i) => i !== index))}
              />
            </div>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2">
        <textarea
          className="fr-input min-h-20 flex-1"
          rows={3}
          value={content}
          placeholder={placeholder}
          aria-label="Votre message"
          onChange={(event) => setContent(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              send();
            }
          }}
          onPaste={(event) => {
            const files = Array.from(event.clipboardData.files);
            if (files.length) {
              event.preventDefault();
              addImageFiles(files);
            }
          }}
        />
        <div className="flex flex-col gap-2">
          <label
            className="fr-btn fr-btn--tertiary fr-btn--sm fr-icon-image-add-line"
            title="Ajouter une capture"
          >
            Ajouter une capture
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(event) => addImageFiles(Array.from(event.target.files ?? []))}
            />
          </label>
          <Button
            type="button"
            size="small"
            disabled={!canSend}
            onClick={send}
          >
            Envoyer
          </Button>
        </div>
      </div>
      <p className="mt-1 mb-0 text-xs text-gray-600">
        Entrée pour envoyer, Maj+Entrée pour aller à la ligne. Collez une capture avec Ctrl+V / Cmd+V.
      </p>
    </div>
  );
}

export default function AdminBugResolution() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [conversations, setConversations] = useState<
    AdminBugInvestigationsResponse['data']['investigations']
  >([]);
  const [pollingKey, setPollingKey] = useState(0);
  const [error, setError] = useState('');
  const threadEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (id) return;
    API.get({ path: 'admin/bug-resolutions' })
      .then((res) => res as AdminBugInvestigationsResponse)
      .then((res) => {
        if (res.ok) setConversations(res.data.investigations);
      });
  }, [id]);

  useEffect(() => {
    setError('');
    if (!id) {
      setConversation(null);
      return;
    }
    let cancelled = false;
    let timeout: number | undefined;
    const load = async () => {
      const res = (await API.get({ path: `admin/bug-resolution/${id}` })) as AdminBugInvestigationResponse;
      if (cancelled || !res.ok || !res.data) return;
      setConversation(res.data.investigation);
      if (res.data.investigation.status === BugInvestigationStatus.EN_COURS) {
        timeout = window.setTimeout(load, POLLING_INTERVAL_MS);
      }
    };
    load();
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [id, pollingKey]);

  const messagesCount = conversation?.messages.length ?? 0;
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ block: 'end' });
  }, [messagesCount]);

  async function send(content: string, images: Array<string>) {
    setError('');
    const res = (await API.post({
      path: id ? `admin/bug-resolution/${id}/message` : 'admin/bug-resolution',
      body: { content, images },
    })) as AdminNewBugInvestigationResponse;
    if (!res.ok || !res.data) {
      setError(res.error || "Le message n'a pas pu être envoyé");
      return false;
    }
    if (id) {
      setPollingKey((key) => key + 1);
    } else {
      navigate(`/app/admin/bug-resolution/${res.data.id}`);
    }
    return true;
  }

  const title = (
    <title>
      Résolution de bug | Admin | Zacharie | Ministère de l'Agriculture et de la Souveraineté Alimentaire
    </title>
  );

  if (!id) {
    return (
      <div className="p-2 md:p-4">
        {title}
        <h1 className="fr-h3">Résolution de bug</h1>
        <p className="text-sm text-gray-600">
          Décrivez le dysfonctionnement ou collez une capture du ticket Notion. Albert enquête dans le code et
          la base de production, en lecture seule, puis propose un rapport et un plan d'action à faire valider
          par un développeur. Vous pouvez ensuite lui répondre pour le corriger ou lui poser des questions.
        </p>
        <div className="mb-8 bg-white p-4 md:p-8">
          <Composer
            disabled={false}
            onSend={send}
            placeholder="Décrivez le problème…"
          />
          {error && <p className="fr-error-text">{error}</p>}
        </div>
        {conversations.length > 0 && (
          <>
            <h2 className="fr-h5">Conversations précédentes</h2>
            <Table
              fixed
              noCaption
              headers={['Date', 'Demandé par', 'Premier message', 'Statut']}
              data={conversations.map((item) => [
                <Link
                  key="date"
                  to={`/app/admin/bug-resolution/${item.id}`}
                >
                  {dayjs(item.created_at).format('DD/MM/YYYY HH:mm')}
                </Link>,
                `${item.User.prenom ?? ''} ${item.User.nom_de_famille ?? ''}`,
                item.description.length > 120 ? `${item.description.slice(0, 120)}…` : item.description,
                <BugInvestigationStatusBadge
                  key="status"
                  status={item.status}
                />,
              ])}
            />
          </>
        )}
      </div>
    );
  }

  if (!conversation) return <Chargement />;

  const isRunning = conversation.status === BugInvestigationStatus.EN_COURS;
  const thread = buildThread(conversation.messages);

  return (
    <div className="flex min-h-full flex-col p-2 md:p-4">
      {title}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link
          to="/app/admin/bug-resolution"
          className="fr-link fr-icon-arrow-left-line fr-link--icon-left"
        >
          Toutes les conversations
        </Link>
        <span className="text-sm text-gray-600">
          {conversation.User.prenom} {conversation.User.nom_de_famille},{' '}
          {dayjs(conversation.created_at).format('DD/MM/YYYY à HH:mm')}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-4">
        {thread.map((block, index) =>
          block.author === 'user' ? (
            <div
              key={index}
              className="bg-open-blue-975 p-4"
            >
              <p className="mb-2 text-sm font-bold">Vous</p>
              <UserMessageContent message={block.message} />
            </div>
          ) : (
            <div
              key={index}
              className="bg-white p-4"
            >
              <p className="mb-2 text-sm font-bold">Albert</p>
              {block.parts.map((part, partIndex) => {
                if (part.kind === 'tool') {
                  return (
                    <details
                      key={partIndex}
                      className="text-sm text-gray-600"
                    >
                      <summary className="cursor-pointer">
                        › {toolLabels[part.call.function.name] ?? part.call.function.name} :{' '}
                        {formatToolArgs(part.call.function.arguments)}
                      </summary>
                      <pre className="mt-1 max-h-96 overflow-auto bg-gray-100 p-2 text-xs whitespace-pre-wrap">
                        {part.result ?? '…'}
                      </pre>
                    </details>
                  );
                }
                if (!part.isFinal) {
                  return (
                    <p
                      key={partIndex}
                      className="my-1 text-sm whitespace-pre-wrap text-gray-600 italic"
                    >
                      {part.text}
                    </p>
                  );
                }
                return (
                  <AlbertAnswer
                    key={partIndex}
                    text={part.text}
                  />
                );
              })}
            </div>
          )
        )}
        {isRunning && (
          <div className="bg-white p-4">
            <p className="mb-2 text-sm text-gray-600 italic">Albert réfléchit…</p>
            {conversation.live_output && (
              <pre className="max-h-64 overflow-auto bg-gray-100 p-2 text-xs whitespace-pre-wrap text-gray-600">
                {conversation.live_output}
              </pre>
            )}
          </div>
        )}
        {conversation.status === BugInvestigationStatus.ERREUR && (
          <div className="fr-alert fr-alert--error fr-alert--sm">
            <p>{conversation.error}</p>
          </div>
        )}
        <div ref={threadEndRef} />
      </div>

      <div className="sticky bottom-0 mt-4 border-t border-gray-200 bg-white p-4">
        <p className="mb-2 text-xs text-gray-600">
          Réponses générées par une IA en lecture seule : vérifiez chaque preuve avant d'agir.
        </p>
        <Composer
          disabled={isRunning}
          onSend={send}
          placeholder={isRunning ? 'Albert est en train de répondre…' : 'Répondez à Albert…'}
        />
        {error && <p className="fr-error-text">{error}</p>}
      </div>
    </div>
  );
}
