import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { CarcasseType, UserRoles, type Carcasse, type Fei, type User } from '@prisma/client';
import type { AssistantFicheData } from '@api/src/types/responses';
import useZustandStore from '@app/zustand/store';
import { createNewCarcasse } from '@app/utils/create-new-carcasse';
import { createHistoryInput } from '@app/utils/create-history-entry';
import { filterCarcassesForFei } from '@app/utils/get-carcasses-for-fei';

dayjs.extend(utc);

function addAssistantLog(
  feiNumero: Fei['numero'],
  user: User,
  assistantRequestId: string,
  action: string,
  history: ReturnType<typeof createHistoryInput>,
  carcasseId: string | null
) {
  useZustandStore.getState().addLog({
    user_id: user.id,
    user_role: UserRoles.CHASSEUR,
    fei_numero: feiNumero,
    action,
    history: { ...history, assistant_request_id: assistantRequestId },
    entity_id: null,
    zacharie_carcasse_id: carcasseId,
    intermediaire_id: null,
    carcasse_intermediaire_id: null,
  });
}

// Écrit sur la fiche un champ choisi par l'assistant (la commune trouvée), avec le log relié à l'échange.
export function updateFeiFromAssistant(
  feiNumero: Fei['numero'],
  nextFei: Partial<Fei>,
  user: User,
  assistantRequestId: string
) {
  const existingFei = useZustandStore.getState().feis[feiNumero];
  useZustandStore.getState().updateFei(feiNumero, nextFei);
  addAssistantLog(
    feiNumero,
    user,
    assistantRequestId,
    'examinateur-assistant-update-fei',
    createHistoryInput(existingFei, nextFei),
    null
  );
}

// Écrit sur la fiche ce que l'assistant Zacharie a compris, par les mêmes fonctions que le formulaire
// (local-first, puis syncData). Albert relit tout l'échange et renvoie souvent ce qui est déjà
// enregistré : on n'écrit que ce qui change. La commune et le propriétaire initial sont choisis à part.
// Renvoie une ligne par donnée écrite, pour la réponse du chat.
export async function applyAssistantFiche(feiNumero: Fei['numero'], data: AssistantFicheData, user: User) {
  const { updateFei, updateCarcasse } = useZustandStore.getState();
  const lignes: Array<string> = [];
  const log = (action: string, history: ReturnType<typeof createHistoryInput>, carcasseId: string | null) =>
    addAssistantLog(feiNumero, user, data.assistant_request_id, action, history, carcasseId);

  const existingFei = useZustandStore.getState().feis[feiNumero];
  const nextFei: Partial<Fei> = {};
  if (
    data.date_mise_a_mort &&
    (!existingFei.date_mise_a_mort ||
      dayjs.utc(existingFei.date_mise_a_mort).format('YYYY-MM-DD') !== data.date_mise_a_mort)
  ) {
    nextFei.date_mise_a_mort = dayjs.utc(data.date_mise_a_mort).startOf('day').toDate();
    lignes.push(`Date de la chasse : ${dayjs.utc(data.date_mise_a_mort).format('DD/MM/YYYY')}`);
  }
  if (
    data.heure_mise_a_mort_premiere_carcasse &&
    data.heure_mise_a_mort_premiere_carcasse !== existingFei.heure_mise_a_mort_premiere_carcasse
  ) {
    nextFei.heure_mise_a_mort_premiere_carcasse = data.heure_mise_a_mort_premiere_carcasse;
    lignes.push(`Heure de mise à mort de la première carcasse : ${data.heure_mise_a_mort_premiere_carcasse}`);
  }
  if (
    data.heure_evisceration_derniere_carcasse &&
    data.heure_evisceration_derniere_carcasse !== existingFei.heure_evisceration_derniere_carcasse
  ) {
    nextFei.heure_evisceration_derniere_carcasse = data.heure_evisceration_derniere_carcasse;
    lignes.push(
      `Heure d'éviscération de la dernière carcasse : ${data.heure_evisceration_derniere_carcasse}`
    );
  }
  if (Object.keys(nextFei).length > 0) {
    updateFei(feiNumero, nextFei);
    log('examinateur-assistant-update-fei', createHistoryInput(existingFei, nextFei), null);
  }

  // les carcasses créées après la date et les heures en reprennent les valeurs
  const fei = useZustandStore.getState().feis[feiNumero];
  const existingCarcasses = filterCarcassesForFei(useZustandStore.getState().carcasses, feiNumero);
  for (const item of data.carcasses) {
    const existingCarcasse = existingCarcasses.find((c) => c.numero_bracelet === item.numero_bracelet);
    if (!existingCarcasse) {
      if (!item.espece) {
        lignes.push(`⚠️ Carcasse ${item.numero_bracelet} non ajoutée : espèce manquante`);
        continue;
      }
      let newCarcasse: Carcasse;
      try {
        newCarcasse = await createNewCarcasse({
          zacharieCarcasseId: `${feiNumero}_${item.numero_bracelet}`,
          numeroBracelet: item.numero_bracelet,
          espece: item.espece,
          nombreDAnimaux: String(item.nombre_d_animaux ?? 1),
          fei,
          examinateurCommentaire: item.commentaire ?? '',
        });
      } catch (error) {
        // même refus que le formulaire (numéro déjà utilisé…) : on le dit et on passe aux suivantes
        lignes.push(`⚠️ Carcasse ${item.numero_bracelet} non ajoutée : ${(error as Error).message}`);
        continue;
      }
      log(
        'examinateur-assistant-carcasse-create',
        createHistoryInput(null, newCarcasse),
        newCarcasse.zacharie_carcasse_id
      );
      lignes.push(`Carcasse ajoutée : ${describeCarcasse(newCarcasse)}`);
      continue;
    }
    const nextCarcasse: Partial<Carcasse> = {};
    if (item.espece && item.espece !== existingCarcasse.espece) {
      nextCarcasse.espece = item.espece;
      nextCarcasse.type = item.type;
    }
    const type = nextCarcasse.type ?? existingCarcasse.type;
    // passer d'un lot de petit gibier à du grand gibier ramène le nombre d'animaux à un
    const nombre =
      type === CarcasseType.PETIT_GIBIER ? (item.nombre_d_animaux ?? existingCarcasse.nombre_d_animaux) : 1;
    if (nombre !== existingCarcasse.nombre_d_animaux) {
      nextCarcasse.nombre_d_animaux = nombre;
    }
    if (item.commentaire && item.commentaire !== existingCarcasse.examinateur_commentaire) {
      nextCarcasse.examinateur_commentaire = item.commentaire;
    }
    if (Object.keys(nextCarcasse).length === 0) continue;
    updateCarcasse(existingCarcasse.zacharie_carcasse_id, nextCarcasse);
    log(
      'examinateur-assistant-carcasse-edit',
      createHistoryInput(existingCarcasse, nextCarcasse),
      existingCarcasse.zacharie_carcasse_id
    );
    lignes.push(`Carcasse modifiée : ${describeCarcasse({ ...existingCarcasse, ...nextCarcasse })}`);
  }

  return lignes;
}

function describeCarcasse(
  carcasse: Pick<Carcasse, 'numero_bracelet' | 'espece' | 'type' | 'nombre_d_animaux'>
) {
  const nombre = carcasse.type === CarcasseType.PETIT_GIBIER ? ` — ${carcasse.nombre_d_animaux} animaux` : '';
  return `${carcasse.numero_bracelet} — ${carcasse.espece}${nombre}`;
}
