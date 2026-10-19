import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@codegouvfr/react-dsfr/Button';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import type { Carcasse, Fei } from '@prisma/client';
import type { AssistantFicheResponse, AssistantTranscriptionResponse } from '@api/src/types/responses';
import API from '@app/services/api';
import { track } from '@app/services/matomo';
import useZustandStore from '@app/zustand/store';
import useUser from '@app/zustand/user';
import { syncData } from '@app/utils/sync-data';
import { normalizeVille } from '@app/utils/search-ville';
import { applyAssistantFiche } from '@app/utils/apply-assistant-fiche';
import useGetCommunesDeChasseFavorites from '@app/utils/useGetCommunesDeChasseFavorites';
import {
  useDesignerPremierDetenteur,
  usePremierDetenteurOptions,
} from '@app/utils/use-designer-premier-detenteur';
import useDictee, { blobToBase64, isDicteeSupported } from '@app/utils/use-dictee';
import DicteeWave from '@app/components/DicteeWave';

dayjs.extend(utc);

type ChatMessage = { role: 'user' | 'assistant'; content: string };

const ACCUEIL = `Bonjour, je suis Zacharie ! Dites-moi tout ce que vous savez de votre chasse : date, commune, heures, propriétaire initial, espèces et numéros de marquage. Vous pouvez ${
  isDicteeSupported ? 'dicter avec le bouton micro' : 'dicter avec le micro de votre clavier'
}.`;

const chipClassName = 'rounded-full border border-[#000091] px-3 py-1 text-sm text-[#000091]';

function getMissingLabels(fei: Fei, carcasses: Array<Carcasse>) {
  const missing: Array<string> = [];
  if (!fei.date_mise_a_mort) missing.push('la date de la chasse');
  if (!fei.commune_mise_a_mort) missing.push('la commune');
  if (!fei.premier_detenteur_user_id && !fei.premier_detenteur_entity_id)
    missing.push('le propriétaire initial');
  if (carcasses.length === 0) missing.push('les carcasses (espèce et numéro de marquage)');
  if (!fei.heure_mise_a_mort_premiere_carcasse)
    missing.push("l'heure de mise à mort de la première carcasse");
  if (!fei.heure_evisceration_derniere_carcasse) {
    missing.push("l'heure d'éviscération de la dernière carcasse");
  }
  return missing;
}

export default function ZacharieChat({
  feiNumero,
  onUpdateFei,
  onClose,
}: {
  feiNumero: Fei['numero'];
  // écrit la fiche comme le formulaire (local-first, avec son log)
  onUpdateFei: (nextFei: Partial<Fei>) => void;
  onClose: () => void;
}) {
  const user = useUser((state) => state.user)!;
  const isOnline = useZustandStore((state) => state.isOnline);
  const fei = useZustandStore((state) => state.feis[feiNumero]);
  const communesFavorites = useGetCommunesDeChasseFavorites().filter(
    (commune): commune is string => !!commune
  );
  const { associationsDeChasse, detenteursInitiaux } = usePremierDetenteurOptions();
  const designerPremierDetenteur = useDesignerPremierDetenteur(feiNumero);
  // mêmes choix que le formulaire, plus « Moi » ; leurs libellés sont envoyés à Albert en liste fermée
  const premierDetenteurChoices = useMemo(() => {
    const choices: Array<{
      label: string;
      chipLabel: string;
      params: Parameters<typeof designerPremierDetenteur>[0];
    }> = [];
    for (const entity of Object.values(associationsDeChasse)) {
      const label = entity.nom_d_usage ?? '';
      choices.push({ label, chipLabel: label, params: { ownerEntity: entity } });
    }
    for (const detenteur of Object.values(detenteursInitiaux)) {
      const label = `${detenteur.prenom} ${detenteur.nom_de_famille}`;
      choices.push({ label, chipLabel: label, params: { ownerUser: detenteur } });
    }
    if (!detenteursInitiaux[user.id]) {
      choices.push({
        label: `${user.prenom} ${user.nom_de_famille}`,
        chipLabel: 'Moi',
        params: { isMe: true },
      });
    }
    return choices.filter((choice) => !!choice.label);
  }, [associationsDeChasse, detenteursInitiaux, user]);
  // les messages envoyés au serveur : l'accueil n'en fait pas partie
  const [messages, setMessages] = useState<Array<ChatMessage>>([]);
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [communeOptions, setCommuneOptions] = useState<Array<string>>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const dictee = useDictee(async (audio) => {
    setIsTranscribing(true);
    try {
      const response = (await API.post({
        path: `/assistant-fiche/${feiNumero}/transcription`,
        body: { audio: await blobToBase64(audio), mime_type: audio.type || 'audio/webm' },
      })) as AssistantTranscriptionResponse;
      if (!response.ok || !response.data) {
        addAssistantMessage(response.error || "Je n'ai pas pu lire l'enregistrement, veuillez réessayer.");
        return;
      }
      const text = response.data.text;
      setDraft((current) => [current.trim(), text].filter(Boolean).join(' '));
    } catch {
      addAssistantMessage("Je n'ai pas pu lire l'enregistrement, veuillez réessayer.");
    } finally {
      setIsTranscribing(false);
    }
  });

  useEffect(() => {
    track('assistant-zacharie', 'ouvrir');
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, communeOptions, isSending, isTranscribing]);

  const addAssistantMessage = (content: string) => {
    setMessages((current) => [...current, { role: 'assistant', content }]);
  };

  const askForMissing = () => {
    const state = useZustandStore.getState();
    const currentFei = state.feis[feiNumero];
    const currentCarcasses = Object.values(state.carcasses).filter(
      (carcasse) => carcasse.fei_numero === feiNumero && !carcasse.deleted_at
    );
    const missing = getMissingLabels(currentFei, currentCarcasses);
    addAssistantMessage(
      missing.length > 0
        ? `Il me manque encore :\n${missing.map((label) => `- ${label}`).join('\n')}`
        : 'Tout est renseigné. Fermez le chat pour vérifier la fiche et la valider.'
    );
  };

  const send = async () => {
    const content = draft.trim();
    if (!content || isSending) return;
    const nextMessages: Array<ChatMessage> = [...messages, { role: 'user', content }];
    setMessages(nextMessages);
    setDraft('');
    setCommuneOptions([]);
    setIsSending(true);
    track('assistant-zacharie', 'envoyer-message');

    // Albert reçoit l'état de la fiche lu en base : les saisies locales doivent y être avant
    if (!useZustandStore.getState().dataIsSynced) await syncData('assistant-zacharie');

    const response = (await API.post({
      path: `/assistant-fiche/${feiNumero}`,
      body: {
        messages: nextMessages,
        premier_detenteur_options: premierDetenteurChoices.map((choice) => choice.label),
      },
    })) as AssistantFicheResponse;
    setIsSending(false);

    if (!response.ok || !response.data) {
      addAssistantMessage(response.error || 'Une erreur est survenue, veuillez réessayer.');
      return;
    }

    const data = response.data;
    if (data.reply) {
      addAssistantMessage(data.reply);
      return;
    }
    const lignes = await applyAssistantFiche(feiNumero, data, user);
    if (lignes.length > 0) {
      addAssistantMessage(["C'est noté :", ...lignes.map((ligne) => `- ${ligne}`)].join('\n'));
      syncData('assistant-zacharie');
    } else if (!data.commune_recherchee && !data.premier_detenteur) {
      addAssistantMessage("Je n'ai trouvé aucune donnée à enregistrer.");
    }

    // Albert peut redonner ce qui est déjà choisi : on ne redemande pas
    const currentFei = useZustandStore.getState().feis[feiNumero];
    const premierDetenteur = premierDetenteurChoices.find(
      (choice) => choice.label === data.premier_detenteur
    );
    if (premierDetenteur && premierDetenteur.label !== currentFei.premier_detenteur_name_cache) {
      selectPremierDetenteur(premierDetenteur, false);
    }

    const commune_recherchee = data.commune_recherchee;
    const communeDejaChoisie =
      !!commune_recherchee &&
      !!currentFei.commune_mise_a_mort &&
      normalizeVille(currentFei.commune_mise_a_mort).includes(normalizeVille(commune_recherchee));
    if (commune_recherchee && !communeDejaChoisie) {
      // les communes de chasse favorites passent devant les homonymes
      const favorites = data.communes_trouvees.filter((commune) => communesFavorites.includes(commune));
      const options = favorites.length === 1 ? favorites : data.communes_trouvees;
      if (options.length === 1) {
        selectCommune(options[0], false);
      } else if (options.length > 1) {
        setCommuneOptions(options);
        addAssistantMessage(`Quelle commune pour « ${commune_recherchee} » ?`);
        return;
      } else {
        addAssistantMessage(`Je ne trouve pas la commune « ${commune_recherchee} ».`);
      }
    }
    askForMissing();
  };

  const selectCommune = (commune: string, thenAskForMissing = true) => {
    onUpdateFei({ commune_mise_a_mort: commune });
    setCommuneOptions([]);
    addAssistantMessage(`Commune : ${commune}`);
    if (thenAskForMissing) askForMissing();
  };

  const selectDate = (date: Date) => {
    onUpdateFei({ date_mise_a_mort: date });
    addAssistantMessage(`Date de la chasse : ${dayjs.utc(date).format('DD/MM/YYYY')}`);
    askForMissing();
  };

  const selectPremierDetenteur = (
    choice: (typeof premierDetenteurChoices)[number],
    thenAskForMissing = true
  ) => {
    designerPremierDetenteur(choice.params);
    addAssistantMessage(`Propriétaire initial : ${choice.label}`);
    if (thenAskForMissing) askForMissing();
  };

  const hasStarted = messages.length > 0;
  const isBusy = isSending || isTranscribing;
  const premierDetenteurMissing = !fei.premier_detenteur_user_id && !fei.premier_detenteur_entity_id;
  const showDateChips = hasStarted && !isBusy && !fei.date_mise_a_mort;
  const showCommuneFavoritesChips =
    hasStarted &&
    !isBusy &&
    !fei.commune_mise_a_mort &&
    communeOptions.length === 0 &&
    communesFavorites.length > 0;
  const showPremierDetenteurChips = hasStarted && !isBusy && premierDetenteurMissing;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="zacharie-chat-title"
      className="fixed inset-0 z-[1000] flex flex-col bg-white"
    >
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <h2
          id="zacharie-chat-title"
          className="fr-h5 m-0"
        >
          Zacharie
        </h2>
        <Button
          priority="tertiary no outline"
          iconId="fr-icon-close-line"
          onClick={onClose}
        >
          Fermer
        </Button>
      </div>
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        {[{ role: 'assistant', content: ACCUEIL } as ChatMessage, ...messages].map((message, index) => (
          <p
            key={index}
            className={[
              'm-0 max-w-[85%] rounded-lg px-4 py-2 whitespace-pre-line',
              message.role === 'user'
                ? 'self-end bg-[#000091] text-white'
                : 'self-start bg-[#E8EDFF] text-black',
            ].join(' ')}
          >
            {message.content}
          </p>
        ))}
        {!isBusy && communeOptions.length > 0 && (
          <ChipGroup label="Commune">
            {communeOptions.map((commune) => (
              <button
                key={commune}
                type="button"
                className={chipClassName}
                onClick={() => selectCommune(commune)}
              >
                {commune}
              </button>
            ))}
          </ChipGroup>
        )}
        {showDateChips && (
          <ChipGroup label="Date de la chasse">
            <button
              type="button"
              className={chipClassName}
              onClick={() => selectDate(dayjs.utc().startOf('day').toDate())}
            >
              Aujourd'hui
            </button>
            <button
              type="button"
              className={chipClassName}
              onClick={() => selectDate(dayjs.utc().subtract(1, 'day').startOf('day').toDate())}
            >
              Hier
            </button>
          </ChipGroup>
        )}
        {showCommuneFavoritesChips && (
          <ChipGroup label="Commune">
            {communesFavorites.slice(0, 5).map((commune) => (
              <button
                key={commune}
                type="button"
                className={chipClassName}
                onClick={() => selectCommune(commune)}
              >
                {commune}
              </button>
            ))}
          </ChipGroup>
        )}
        {showPremierDetenteurChips && (
          <ChipGroup label="Propriétaire initial">
            {premierDetenteurChoices.map((choice) => (
              <button
                key={choice.label}
                type="button"
                className={chipClassName}
                onClick={() => selectPremierDetenteur(choice)}
              >
                {choice.chipLabel}
              </button>
            ))}
          </ChipGroup>
        )}
        {isSending && <p className="m-0 self-start text-sm text-gray-500">Zacharie écrit…</p>}
        {isTranscribing && <p className="m-0 self-start text-sm text-gray-500">Zacharie écoute…</p>}
        <div ref={bottomRef} />
      </div>
      {dictee.stream && (
        <div className="border-t border-gray-200 px-4 pt-3">
          <DicteeWave stream={dictee.stream} />
        </div>
      )}
      <form
        className="flex items-end gap-2 border-t border-gray-200 p-4"
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
      >
        <textarea
          className="fr-input min-h-20 flex-1"
          aria-label="Votre message à Zacharie"
          placeholder={
            dictee.isRecording
              ? 'Parlez, puis appuyez sur « Arrêter »'
              : isOnline
                ? 'Ex : hier à Moulins, 2 chevreuils JD-03-001 et JD-03-002'
                : 'Connexion requise'
          }
          value={draft}
          disabled={!isOnline}
          onChange={(event) => setDraft(event.target.value)}
        />
        <div className="flex flex-col gap-2">
          {isDicteeSupported && (
            <Button
              type="button"
              priority={dictee.isRecording ? 'primary' : 'secondary'}
              iconId={dictee.isRecording ? 'fr-icon-stop-circle-line' : 'fr-icon-mic-line'}
              disabled={!isOnline || isBusy}
              onClick={() => {
                if (dictee.isRecording) {
                  dictee.stop();
                  return;
                }
                track('assistant-zacharie', 'dicter');
                dictee.start().catch(() => addAssistantMessage("Le micro n'est pas accessible."));
              }}
            >
              {dictee.isRecording ? 'Arrêter' : 'Dicter'}
            </Button>
          )}
          <Button
            type="submit"
            disabled={!isOnline || isBusy || dictee.isRecording || !draft.trim()}
          >
            Envoyer
          </Button>
        </div>
      </form>
    </div>
  );
}

function ChipGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 self-start">
      <span className="text-sm text-gray-600">{label}</span>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
