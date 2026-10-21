import express from 'express';
import request from 'supertest';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { CarcasseType, UserRoles, type Fei } from '@prisma/client';

vi.mock('~/config', async (importOriginal) => ({
  ...(await importOriginal<typeof import('~/config')>()),
  ALBERT_API_KEY: 'test-key',
}));
vi.mock('~/third-parties/albert', () => ({ albertChatCompletion: vi.fn(), transcribeAudio: vi.fn() }));
vi.mock('~/third-parties/sentry', () => ({ capture: vi.fn(), captureException: vi.fn() }));

import assistantFicheRouter from '~/controllers/assistant-fiche';
import prisma from '~/prisma';
import { albertChatCompletion, transcribeAudio } from '~/third-parties/albert';

const examinateur = {
  id: 'user-cfei',
  roles: [UserRoles.CHASSEUR],
  numero_cfei: 'CFEI-03-24-001',
  activated: true,
  prenom: 'Jean',
  nom_de_famille: 'Dupont',
};

const fei: Partial<Fei> & { numero: string } = {
  numero: 'ZACH-20261019-user-cfei-080000',
  examinateur_initial_user_id: 'user-cfei',
  examinateur_initial_approbation_mise_sur_le_marche: null,
  date_mise_a_mort: null,
  commune_mise_a_mort: null,
  heure_mise_a_mort_premiere_carcasse: null,
  heure_evisceration_derniere_carcasse: null,
  deleted_at: null,
  version: 1,
};

const app = express();
app.use(express.json());
app.use('/assistant-fiche', assistantFicheRouter);

function post(body: object, user: object = examinateur) {
  return request(app)
    .post(`/assistant-fiche/${fei.numero}`)
    .set('x-test-user', JSON.stringify(user))
    .send(body);
}

function albertCalls(args: object) {
  vi.mocked(albertChatCompletion).mockResolvedValue({
    message: {
      role: 'assistant',
      content: null,
      tool_calls: [
        {
          id: 'call-1',
          type: 'function',
          function: { name: 'remplir_fiche', arguments: JSON.stringify(args) },
        },
      ],
    },
    finishReason: 'tool_calls',
  });
}

const message = { messages: [{ role: 'user', content: 'hier à Moulins, deux chevreuils' }] };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.fei.findUnique).mockResolvedValue(fei as never);
  vi.mocked(prisma.carcasse.findMany).mockResolvedValue([]);
});

describe('POST /assistant-fiche/:fei_numero', () => {
  test("refuse un utilisateur qui n'est pas examinateur initial", async () => {
    const res = await post(message, { ...examinateur, numero_cfei: null });
    expect(res.status).toBe(403);
    expect(albertChatCompletion).not.toHaveBeenCalled();
  });

  test("refuse la fiche d'un autre examinateur", async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValue({
      ...fei,
      examinateur_initial_user_id: 'other',
    } as never);
    const res = await post(message);
    expect(res.status).toBe(404);
    expect(albertChatCompletion).not.toHaveBeenCalled();
  });

  test('refuse une fiche déjà validée', async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValue({
      ...fei,
      examinateur_initial_approbation_mise_sur_le_marche: true,
    } as never);
    const res = await post(message);
    expect(res.status).toBe(403);
  });

  test('renvoie les données vérifiées sans rien écrire sur la fiche', async () => {
    const today = new Date().toISOString().slice(0, 10);
    albertCalls({
      date_mise_a_mort: today,
      commune_mise_a_mort: 'Chassenard',
      heure_mise_a_mort_premiere_carcasse: '7:30',
      carcasses: [
        { numero_bracelet: 'JD-03-001', espece: 'Chevreuil', nombre_d_animaux: 3 },
        { numero_bracelet: 'JD-03-002', espece: 'Faisans de chasse', nombre_d_animaux: 5 },
      ],
    });
    const res = await post(message);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      reply: '',
      date_mise_a_mort: today,
      heure_mise_a_mort_premiere_carcasse: '07:30',
      heure_evisceration_derniere_carcasse: null,
      commune_recherchee: 'Chassenard',
      communes_trouvees: ['03510 CHASSENARD'],
      premier_detenteur: null,
      carcasses: [
        // grand gibier : une carcasse par animal
        {
          numero_bracelet: 'JD-03-001',
          espece: 'Chevreuil',
          type: CarcasseType.GROS_GIBIER,
          nombre_d_animaux: 1,
        },
        {
          numero_bracelet: 'JD-03-002',
          espece: 'Faisans de chasse',
          type: CarcasseType.PETIT_GIBIER,
          nombre_d_animaux: 5,
        },
      ],
    });
    // seul l'échange est écrit, relié aux écritures du front par le même identifiant
    expect(prisma.fei.update).not.toHaveBeenCalled();
    expect(prisma.carcasse.create).not.toHaveBeenCalled();
    expect(prisma.log.createMany).toHaveBeenCalledTimes(1);
    const exchange = (
      vi.mocked(prisma.log.createMany).mock.calls[0][0]!.data as Array<{
        action: string;
        history: Record<string, unknown>;
      }>
    )[0];
    expect(exchange.action).toBe('examinateur-assistant-message');
    expect(exchange.history).toMatchObject({
      assistant_request_id: res.body.data.assistant_request_id,
      user_message: 'hier à Moulins, deux chevreuils',
      validation_issues: null,
      error: null,
      result: { commune_recherchee: 'Chassenard' },
    });
  });

  test('trouve la commune dite avec son code postal après le nom', async () => {
    albertCalls({ commune_mise_a_mort: 'Moulins 03000' });
    const res = await post(message);
    expect(res.body.data.communes_trouvees).toEqual(['03000 MOULINS']);
  });

  test('propose les communes homonymes à choisir', async () => {
    albertCalls({ commune_mise_a_mort: 'Moulins' });
    const res = await post(message);
    expect(res.body.data.communes_trouvees.length).toBeGreaterThan(1);
    expect(res.body.data.communes_trouvees).toContain('03000 MOULINS');
  });

  test("garde la dernière mention d'un même numéro de marquage", async () => {
    albertCalls({
      carcasses: [
        { numero_bracelet: '1230', espece: 'Sanglier' },
        { numero_bracelet: '1230', commentaire: 'balle dans le ventre' },
      ],
    });
    const res = await post(message);
    expect(res.body.data.carcasses).toEqual([
      {
        numero_bracelet: '1230',
        espece: 'Sanglier',
        type: CarcasseType.GROS_GIBIER,
        nombre_d_animaux: 1,
        commentaire: 'balle dans le ventre',
      },
    ]);
  });

  test("renvoie le propriétaire initial nommé, seulement s'il est dans la liste proposée", async () => {
    const options = ['Les petits pieds', 'Pierre Petit'];
    albertCalls({ premier_detenteur: 'Les petits pieds' });
    const res = await post({ ...message, premier_detenteur_options: options });
    expect(res.status).toBe(200);
    expect(res.body.data.premier_detenteur).toBe('Les petits pieds');
    const tools = vi.mocked(albertChatCompletion).mock.calls[0][0].tools!;
    expect(tools[0].function.parameters).toMatchObject({
      properties: { premier_detenteur: { enum: options } },
    });

    albertCalls({ premier_detenteur: 'Inconnu' });
    const resInconnu = await post({ ...message, premier_detenteur_options: options });
    expect(resInconnu.body.data.premier_detenteur).toBeNull();
  });

  test('écarte une carcasse à l’espèce hors liste et garde le reste', async () => {
    albertCalls({
      heure_mise_a_mort_premiere_carcasse: '07:30',
      carcasses: [
        { numero_bracelet: 'JD-03-001', espece: 'Ours' },
        { numero_bracelet: 'JD-03-002', espece: 'Chevreuil' },
      ],
    });
    const res = await post(message);
    expect(res.status).toBe(200);
    expect(res.body.data.reply).toBe('');
    expect(res.body.data.heure_mise_a_mort_premiere_carcasse).toBe('07:30');
    expect(res.body.data.carcasses).toEqual([
      {
        numero_bracelet: 'JD-03-002',
        espece: 'Chevreuil',
        type: CarcasseType.GROS_GIBIER,
        nombre_d_animaux: 1,
        commentaire: null,
      },
    ]);
    // la sortie refusée reste lisible dans le log de l'échange
    const exchange = vi.mocked(prisma.log.createMany).mock.calls[0][0]!.data as Array<{
      history: Record<string, unknown>;
    }>;
    expect(exchange[0].history.tool_arguments).toContain('Ours');
    expect(exchange[0].history.validation_issues).not.toBeNull();
  });

  test("renvoie la réponse d'Albert quand il n'appelle pas l'outil", async () => {
    vi.mocked(albertChatCompletion).mockResolvedValue({
      message: { role: 'assistant', content: 'Quel est le numéro de marquage ?' },
      finishReason: 'stop',
    });
    const res = await post(message);
    expect(res.status).toBe(200);
    expect(res.body.data.reply).toBe('Quel est le numéro de marquage ?');
    expect(res.body.data.carcasses).toEqual([]);
  });
});

describe('POST /assistant-fiche/:fei_numero/transcription', () => {
  function postAudio(body: object, user: object = examinateur) {
    return request(app)
      .post(`/assistant-fiche/${fei.numero}/transcription`)
      .set('x-test-user', JSON.stringify(user))
      .send(body);
  }

  test('renvoie le texte dicté', async () => {
    vi.mocked(transcribeAudio).mockResolvedValue('hier à Moulins deux chevreuils');
    const res = await postAudio({
      audio: Buffer.from('audio').toString('base64'),
      mime_type: 'audio/webm;codecs=opus',
    });
    expect(res.status).toBe(200);
    expect(res.body.data.text).toBe('hier à Moulins deux chevreuils');
    expect(vi.mocked(transcribeAudio).mock.calls[0][1]).toBe('audio/webm;codecs=opus');
  });

  test("refuse un utilisateur qui n'est pas examinateur initial", async () => {
    const res = await postAudio(
      { audio: 'YQ==', mime_type: 'audio/webm' },
      { ...examinateur, numero_cfei: null }
    );
    expect(res.status).toBe(403);
    expect(transcribeAudio).not.toHaveBeenCalled();
  });

  test('refuse une fiche déjà validée', async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValue({
      ...fei,
      examinateur_initial_approbation_mise_sur_le_marche: true,
    } as never);
    const res = await postAudio({ audio: 'YQ==', mime_type: 'audio/webm' });
    expect(res.status).toBe(403);
    expect(transcribeAudio).not.toHaveBeenCalled();
  });

  test("refuse un fichier qui n'est pas de l'audio", async () => {
    const res = await postAudio({ audio: 'YQ==', mime_type: 'image/png' });
    expect(res.status).toBe(400);
    expect(transcribeAudio).not.toHaveBeenCalled();
  });
});
