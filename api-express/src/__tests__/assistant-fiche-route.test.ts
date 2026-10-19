import express from 'express';
import request from 'supertest';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { CarcasseType, FeiOwnerRole, UserRoles, type Fei } from '@prisma/client';

vi.mock('~/config', async (importOriginal) => ({
  ...(await importOriginal<typeof import('~/config')>()),
  ALBERT_API_KEY: 'test-key',
}));
vi.mock('~/third-parties/albert', () => ({ albertChatCompletion: vi.fn(), transcribeAudio: vi.fn() }));
vi.mock('~/utils/sync-fei', () => ({ syncFei: vi.fn() }));
vi.mock('~/utils/sync-carcasse', () => ({ syncCarcasse: vi.fn() }));
vi.mock('~/utils/sync-scope', () => ({ createSyncScope: vi.fn(async () => ({})) }));
vi.mock('~/utils/fei-side-effects', () => ({
  runFeiUpdateSideEffects: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('~/utils/carcasse-side-effects', () => ({
  runCarcasseUpdateSideEffects: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('~/third-parties/sentry', () => ({ capture: vi.fn(), captureException: vi.fn() }));

import assistantFicheRouter from '~/controllers/assistant-fiche';
import prisma from '~/prisma';
import { albertChatCompletion, transcribeAudio } from '~/third-parties/albert';
import { syncFei } from '~/utils/sync-fei';
import { syncCarcasse } from '~/utils/sync-carcasse';

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
  vi.mocked(syncFei).mockImplementation(async (_numero, body) => ({
    savedFei: { ...fei, ...body } as never,
    existingFei: fei as never,
    isDeleted: false,
  }));
  vi.mocked(syncCarcasse).mockImplementation(async (_fei, _id, body) => ({
    savedCarcasse: body as never,
    existingCarcasse: body as never,
    isDeleted: false,
  }));
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

  test('écrit la fiche et crée les carcasses dictées', async () => {
    albertCalls({
      date_mise_a_mort: new Date().toISOString().slice(0, 10),
      commune_mise_a_mort: 'Moulins',
      heure_mise_a_mort_premiere_carcasse: '07:30',
      carcasses: [
        { numero_bracelet: 'JD-03-001', espece: 'Chevreuil' },
        { numero_bracelet: 'JD-03-002', espece: 'Faisans de chasse', nombre_d_animaux: 5 },
      ],
    });
    const res = await post(message);
    expect(res.status).toBe(200);
    expect(res.body.data.commune_recherchee).toBe('Moulins');

    expect(syncFei).toHaveBeenCalledTimes(1);
    const feiBody = vi.mocked(syncFei).mock.calls[0][1];
    expect(feiBody.heure_mise_a_mort_premiere_carcasse).toBe('07:30');
    // syncFei valide la date comme une chaîne (format du corps /sync)
    expect(feiBody.date_mise_a_mort).toBe(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
    // la commune est choisie côté front dans le référentiel
    expect(feiBody).not.toHaveProperty('commune_mise_a_mort');

    expect(syncCarcasse).toHaveBeenCalledTimes(2);
    const [chevreuil, faisans] = vi.mocked(syncCarcasse).mock.calls.map((call) => call[2]);
    expect(chevreuil).toMatchObject({
      zacharie_carcasse_id: `${fei.numero}_JD-03-001`,
      espece: 'Chevreuil',
      type: CarcasseType.GROS_GIBIER,
      nombre_d_animaux: 1,
      examinateur_initial_user_id: 'user-cfei',
      current_owner_role: FeiOwnerRole.EXAMINATEUR_INITIAL,
      heure_mise_a_mort_premiere_carcasse_fei: '07:30',
    });
    expect(faisans).toMatchObject({ type: CarcasseType.PETIT_GIBIER, nombre_d_animaux: 5 });
    // les écritures, puis l'échange, reliés par le même identifiant
    expect(prisma.log.createMany).toHaveBeenCalledTimes(2);
    const [writeLogs, exchangeLogs] = vi
      .mocked(prisma.log.createMany)
      .mock.calls.map((call) => call[0]!.data as Array<{ action: string; history: Record<string, unknown> }>);
    const exchange = exchangeLogs[0];
    expect(exchange.action).toBe('examinateur-assistant-message');
    expect(exchange.history).toMatchObject({
      user_message: 'hier à Moulins, deux chevreuils',
      validation_issues: null,
      error: null,
    });
    expect(JSON.parse(exchange.history.tool_arguments as string).commune_mise_a_mort).toBe('Moulins');
    expect(exchange.history.reply).toContain('Carcasse ajoutée : JD-03-001 — Chevreuil');
    for (const log of writeLogs) {
      expect(log.history.assistant_request_id).toBe(exchange.history.assistant_request_id);
    }
    expect(res.body.data.reply).toContain('Carcasse ajoutée : JD-03-001 — Chevreuil');
  });

  test("modifie une carcasse existante sans toucher à ce qui n'est pas dit", async () => {
    vi.mocked(prisma.carcasse.findMany).mockResolvedValue([
      {
        zacharie_carcasse_id: `${fei.numero}_JD-03-001`,
        numero_bracelet: 'JD-03-001',
        espece: 'Chevreuil',
        type: CarcasseType.GROS_GIBIER,
        nombre_d_animaux: 1,
        version: 3,
      },
    ] as never);
    albertCalls({ carcasses: [{ numero_bracelet: 'JD-03-001', espece: 'Sanglier' }] });
    const res = await post(message);
    expect(res.status).toBe(200);
    expect(syncFei).not.toHaveBeenCalled();
    const body = vi.mocked(syncCarcasse).mock.calls[0][2];
    expect(body).toMatchObject({ espece: 'Sanglier', version: 3 });
    expect(body).not.toHaveProperty('current_owner_role');
    expect(body).not.toHaveProperty('deleted_at');
    expect(res.body.data.reply).toContain('Carcasse modifiée : JD-03-001 — Sanglier');
  });

  test("renvoie le propriétaire initial nommé, seulement s'il est dans la liste proposée", async () => {
    const options = ['Les petits pieds', 'Pierre Petit'];
    albertCalls({ premier_detenteur: 'Les petits pieds' });
    const res = await post({ ...message, premier_detenteur_options: options });
    expect(res.status).toBe(200);
    expect(res.body.data.premier_detenteur_choisi).toBe('Les petits pieds');
    // le front l'enregistre et le confirme : pas de « C'est noté » vide
    expect(res.body.data.reply).toBe('');
    const tools = vi.mocked(albertChatCompletion).mock.calls[0][0].tools!;
    expect(tools[0].function.parameters).toMatchObject({
      properties: { premier_detenteur: { enum: options } },
    });

    albertCalls({ premier_detenteur: 'Inconnu' });
    const resInconnu = await post({ ...message, premier_detenteur_options: options });
    expect(resInconnu.body.data.premier_detenteur_choisi).toBeNull();
  });

  test("n'écrit pas ce qui est déjà enregistré (Albert relit tout l'échange)", async () => {
    vi.mocked(prisma.fei.findUnique).mockResolvedValue({
      ...fei,
      date_mise_a_mort: new Date('2026-10-18T00:00:00.000Z'),
      heure_mise_a_mort_premiere_carcasse: '08:30',
    } as never);
    vi.mocked(prisma.carcasse.findMany).mockResolvedValue([
      {
        zacharie_carcasse_id: `${fei.numero}_1230`,
        numero_bracelet: '1230',
        espece: 'Sanglier',
        type: CarcasseType.GROS_GIBIER,
        nombre_d_animaux: 1,
        version: 2,
      },
    ] as never);
    albertCalls({
      date_mise_a_mort: '2026-10-18',
      heure_mise_a_mort_premiere_carcasse: '8:30',
      heure_evisceration_derniere_carcasse: '17:00',
      carcasses: [{ numero_bracelet: '1230', espece: 'Sanglier' }],
    });
    const res = await post(message);
    expect(res.status).toBe(200);
    expect(syncCarcasse).not.toHaveBeenCalled();
    // seule l'heure d'éviscération est nouvelle
    const feiBody = vi.mocked(syncFei).mock.calls[0][1];
    expect(feiBody).not.toHaveProperty('date_mise_a_mort');
    expect(feiBody).not.toHaveProperty('heure_mise_a_mort_premiere_carcasse');
    expect(feiBody.heure_evisceration_derniere_carcasse).toBe('17:00');
    expect(res.body.data.reply).not.toContain('Carcasse');
  });

  test("n'écrit rien si Albert renvoie une espèce hors liste", async () => {
    albertCalls({ carcasses: [{ numero_bracelet: 'JD-03-001', espece: 'Ours' }] });
    const res = await post(message);
    expect(res.status).toBe(200);
    expect(syncCarcasse).not.toHaveBeenCalled();
    expect(res.body.data.reply).toContain('reformuler');
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
    expect(syncFei).not.toHaveBeenCalled();
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

  test("refuse un fichier qui n'est pas de l'audio", async () => {
    const res = await postAudio({ audio: 'YQ==', mime_type: 'image/png' });
    expect(res.status).toBe(400);
    expect(transcribeAudio).not.toHaveBeenCalled();
  });
});
