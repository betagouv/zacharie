import { describe, test, expect, vi, beforeEach } from 'vitest';
import prisma from '~/prisma';
import {
  bracelesPresentsDansTexte,
  choisirPoolParBracelets,
  dedupeAttachmentsByName,
  documentTypeForAttachment,
  extractFtpReferences,
  extractPoolReferences,
  ingestInboundEmail,
  inboundEmailPayloadSchema,
  isSupportedAttachment,
  messageIdFromItem,
  normalizeContentType,
  resultatApplicable,
  searchableTextFromItem,
  type InboundEmailItem,
} from '~/utils/trichine-inbound-email';
import { downloadInboundAttachment } from '~/third-parties/brevo-inbound';
import { extractPdfText } from '~/utils/pdf-text';
import { applyPoolResult } from '~/utils/trichine-result';
import { RAPPORT_LVD_NEGATIF } from './fixtures/rapport-lvd-lda39';
import { uploadToCellar } from '~/third-parties/cellar';

vi.mock('~/third-parties/sentry', () => ({ capture: vi.fn() }));
vi.mock('~/third-parties/brevo-inbound', () => ({
  downloadInboundAttachment: vi.fn().mockResolvedValue(Buffer.from('%PDF-1.4 rapport')),
}));
vi.mock('~/utils/pdf-text', () => ({ extractPdfText: vi.fn().mockResolvedValue(null) }));
vi.mock('~/utils/trichine-result', () => ({
  applyPoolResult: vi.fn().mockResolvedValue({ kind: 'ok', pool: null }),
}));
vi.mock('~/third-parties/cellar', () => ({
  IS_CELLAR_CONFIGURED: true,
  uploadToCellar: vi.fn().mockResolvedValue('key'),
  trichineDocumentKey: ({ documentId, extension }: { documentId: string; extension: string }) =>
    `trichine/RAPPORT_COFRAC/2026/${documentId}.${extension}`,
}));

/* -------------------------------------------------------------------------- */
/* Lecture du message                                                          */
/* -------------------------------------------------------------------------- */

describe('références dans le message', () => {
  test('trouve les références de pool, dédoublonnées et insensibles à la casse', () => {
    const text = 'Résultats pour p-26-000045 et P-26-000046 (rappel : P-26-000045)';
    expect(extractPoolReferences(text)).toEqual(['P-26-000045', 'P-26-000046']);
  });
  test('distingue pools et FTP', () => {
    const text = 'Fiche F-26-000012 — pool P-26-000045';
    expect(extractPoolReferences(text)).toEqual(['P-26-000045']);
    expect(extractFtpReferences(text)).toEqual(['F-26-000012']);
  });
  test('ignore une référence mal formée', () => {
    expect(extractPoolReferences('P-26-45 et P-2026-000045')).toEqual([]);
  });
  test('fouille le sujet, le corps HTML et le nom des pièces jointes', () => {
    const text = searchableTextFromItem({
      Subject: 'Rapport',
      RawHtmlBody: '<p>Pool <b>P-26-000045</b></p>',
      Attachments: [{ Name: 'P-26-000046.pdf', ContentType: 'application/pdf', DownloadToken: 'tok' }],
    } as InboundEmailItem);
    expect(extractPoolReferences(text)).toEqual(['P-26-000045', 'P-26-000046']);
  });
});

describe('pièces jointes', () => {
  test('normalise le content-type envoyé par les clients mail', () => {
    expect(normalizeContentType('Application/PDF; name="rapport.pdf"')).toBe('application/pdf');
    expect(isSupportedAttachment('application/pdf; name="rapport.pdf"')).toBe(true);
    expect(isSupportedAttachment('application/vnd.ms-excel')).toBe(false);
  });
  test('un PDF est un rapport COFRAC, le reste est AUTRE', () => {
    expect(documentTypeForAttachment('application/pdf')).toBe('RAPPORT_COFRAC');
    expect(documentTypeForAttachment('image/png')).toBe('AUTRE');
  });
  test('deux pièces jointes homonymes ne comptent que pour une', () => {
    const attachments = [
      { Name: 'rapport.pdf', ContentType: 'application/pdf', DownloadToken: 'a' },
      { Name: 'rapport.pdf', ContentType: 'application/pdf', DownloadToken: 'b' },
    ];
    expect(dedupeAttachmentsByName(attachments)).toHaveLength(1);
  });
});

describe('identifiant de message', () => {
  test('utilise le MessageId, sinon l’Uuid Brevo', () => {
    expect(messageIdFromItem({ MessageId: '<abc@labo>' } as InboundEmailItem)).toBe('<abc@labo>');
    expect(messageIdFromItem({ Uuid: ['uuid-1'] } as InboundEmailItem)).toBe('uuid-1');
  });
  test('fabrique un identifiant stable quand Brevo n’en donne aucun', () => {
    const item = { Subject: 'Rapport' } as InboundEmailItem;
    expect(messageIdFromItem(item)).toBe(messageIdFromItem({ ...item }));
  });
});

describe('payload du webhook', () => {
  test('accepte le format Brevo', () => {
    const parsed = inboundEmailPayloadSchema.safeParse({
      items: [{ MessageId: '<a@b>', From: { Name: 'LVD', Address: 'labo@lvd.fr' }, Subject: 'Rapport' }],
    });
    expect(parsed.success).toBe(true);
  });
  test('refuse un payload sans items', () => {
    expect(inboundEmailPayloadSchema.safeParse({ MessageId: '<a@b>' }).success).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */
/* Ingestion                                                                   */
/* -------------------------------------------------------------------------- */

const pdf = { Name: 'rapport.pdf', ContentType: 'application/pdf', DownloadToken: 'token-1' };

function mailDuLabo(overrides: Partial<InboundEmailItem> = {}): InboundEmailItem {
  return {
    MessageId: '<rapport-1@lvd.fr>',
    From: { Name: 'LVD 44', Address: 'Labo@lvd.fr' },
    Subject: 'Rapport d’analyse pool P-26-000045',
    SentAtDate: 'Tue, 1 Sep 2026 09:53:21 +0200',
    Attachments: [pdf],
    ...overrides,
  } as InboundEmailItem;
}

// Pool tel que le renvoie la requête d'ingestion : avec son lien vers la FTP du laboratoire
function poolFixture(reference: string) {
  return {
    id: `pool-${reference}`,
    reference_pool: reference,
    resultat_analyse: null as string | null,
    date_debut_analyse: null as Date | null,
    commentaire: null as string | null,
    deleted_at: null as Date | null,
    TrichineEchantillons: [] as unknown[],
    TrichinePoolFTPs: [
      {
        id: `link-${reference}`,
        TrichineFTP: {
          id: 'ftp-1',
          deleted_at: null as Date | null,
          statut_logistique: 'RECUE',
          destinataire_entity_id: 'entity-lvd',
          ftp_parent_id: null as string | null,
          expediteur_user_id: 'user-chasseur',
          expediteur_entity_id: 'entity-chasseur',
        },
      },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(downloadInboundAttachment).mockResolvedValue(Buffer.from('%PDF-1.4 rapport'));
  vi.mocked(extractPdfText).mockResolvedValue(null);
  vi.mocked(applyPoolResult).mockResolvedValue({ kind: 'ok', pool: null } as never);
  vi.mocked(prisma.trichineDocument.findFirst).mockResolvedValue(null as never);
  vi.mocked(prisma.trichineDocument.create).mockResolvedValue({ id: 'doc-1' } as never);
  vi.mocked(prisma.trichineDocument.update).mockResolvedValue({ id: 'doc-1' } as never);
  vi.mocked(prisma.entityAndUserRelations.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.trichinePool.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.trichineFTP.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.emailEntrant.upsert).mockResolvedValue({ id: 'log-1' } as never);
});

// L'expéditeur est un utilisateur du laboratoire destinataire de la FTP qui porte le pool
function expediteurEstLeLaboDestinataire() {
  vi.mocked(prisma.entityAndUserRelations.findMany).mockResolvedValue([
    { owner_id: 'user-labo', entity_id: 'entity-lvd', EntityRelatedWithUser: { is_lnr: false } },
  ] as never);
  vi.mocked(prisma.trichinePool.findMany).mockResolvedValue([poolFixture('P-26-000045')] as never);
}

// Tous les pools cherchés existent et sont destinés au laboratoire
function tousLesPoolsExistent() {
  vi.mocked(prisma.entityAndUserRelations.findMany).mockResolvedValue([
    { owner_id: 'user-labo', entity_id: 'entity-lvd', EntityRelatedWithUser: { is_lnr: false } },
  ] as never);
  vi.mocked(prisma.trichinePool.findMany).mockImplementation((async (args: any) =>
    (args.where.reference_pool.in as string[]).map(poolFixture)) as never);
}

describe('ingestInboundEmail', () => {
  test('rattache le rapport au pool quand l’expéditeur est le laboratoire destinataire', async () => {
    expediteurEstLeLaboDestinataire();

    const result = await ingestInboundEmail(mailDuLabo());

    expect(result).toMatchObject({ stored: 1, skipped: 0, failed: 0 });
    expect(result.attachments[0]).toMatchObject({
      nom_fichier: 'rapport.pdf',
      statut: 'stocke',
      pool_reference: 'P-26-000045',
      rattachement_source: 'EMAIL',
    });
    expect(prisma.trichineDocument.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ pool_id: 'pool-P-26-000045' }),
    });
    expect(uploadToCellar).toHaveBeenCalledOnce();
    expect(prisma.trichineDocument.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'RAPPORT_COFRAC',
        source: 'EMAIL',
        ajoute_par_user_id: null,
        pool_id: 'pool-P-26-000045',
        nom_fichier: 'rapport.pdf',
        email_message_id: '<rapport-1@lvd.fr>',
        email_expediteur: 'labo@lvd.fr',
      }),
    });
  });

  test('stocke sans rattachement quand le pool n’est pas destiné à l’expéditeur', async () => {
    vi.mocked(prisma.entityAndUserRelations.findMany).mockResolvedValue([
      { owner_id: 'user-labo', entity_id: 'entity-autre-labo', EntityRelatedWithUser: { is_lnr: false } },
    ] as never);
    // Le pool existe, mais aucune FTP ne le destine à ce laboratoire : pas de lien exploitable
    vi.mocked(prisma.trichinePool.findMany).mockResolvedValue([poolFixture('P-26-000045')] as never);

    const result = await ingestInboundEmail(mailDuLabo());

    expect(result).toMatchObject({ stored: 1 });
    expect(result.attachments[0].pool_reference).toBeUndefined();
    expect(prisma.trichineDocument.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        pool_id: undefined,
        ftp_id: undefined,
        rattachement_source: undefined,
      }),
    });
  });

  test('ne rattache rien si l’expéditeur n’est pas un utilisateur laboratoire', async () => {
    const result = await ingestInboundEmail(mailDuLabo({ From: { Address: 'inconnu@gmail.com' } }));

    expect(result).toMatchObject({ stored: 1 });
    expect(result.attachments[0].pool_reference).toBeUndefined();
    expect(prisma.trichinePool.findMany).not.toHaveBeenCalled();
  });

  test('écarte un expéditeur inconnu qui ne cite aucune référence', async () => {
    const result = await ingestInboundEmail(
      mailDuLabo({ From: { Address: 'spam@ailleurs.fr' }, Subject: 'Bonjour' })
    );

    expect(result.ignored).toBe('expediteur_inconnu_sans_reference');
    expect(downloadInboundAttachment).not.toHaveBeenCalled();
  });

  test('écarte un message trop spammy', async () => {
    const result = await ingestInboundEmail(mailDuLabo({ SpamScore: 8.2 }));

    expect(result.ignored).toBe('spam');
    expect(downloadInboundAttachment).not.toHaveBeenCalled();
  });

  test('écarte un message sans pièce jointe exploitable', async () => {
    const result = await ingestInboundEmail(
      mailDuLabo({
        Attachments: [
          { Name: 'resultats.xlsx', ContentType: 'application/vnd.ms-excel', DownloadToken: 't' },
        ],
      })
    );

    expect(result.ignored).toBe('aucune_piece_jointe_exploitable');
  });

  test('ne stocke pas deux fois la même pièce jointe si Brevo rejoue le webhook', async () => {
    expediteurEstLeLaboDestinataire();
    vi.mocked(prisma.trichineDocument.findFirst).mockResolvedValue({ id: 'doc-existant' } as never);

    const result = await ingestInboundEmail(mailDuLabo());

    expect(result).toMatchObject({ stored: 0, skipped: 1 });
    expect(result.attachments[0].statut).toBe('deja_stocke');
    expect(downloadInboundAttachment).not.toHaveBeenCalled();
    expect(prisma.trichineDocument.create).not.toHaveBeenCalled();
  });

  test('compte un échec quand le téléchargement de la pièce jointe échoue', async () => {
    expediteurEstLeLaboDestinataire();
    vi.mocked(downloadInboundAttachment).mockResolvedValue(null);

    const result = await ingestInboundEmail(mailDuLabo());

    expect(result).toMatchObject({ stored: 0, failed: 1 });
    expect(result.attachments[0].statut).toBe('echec');
    expect(prisma.trichineDocument.create).not.toHaveBeenCalled();
  });
});

describe('le contenu du fichier prime sur le message', () => {
  test('rattache au pool lu dans le PDF, pas à celui du sujet', async () => {
    tousLesPoolsExistent();
    // Le sujet cite P-26-000045, le PDF P-26-000099 : les deux existent et sont destinés au labo
    vi.mocked(extractPdfText).mockResolvedValue(
      'Rapport COFRAC — référence client P-26-000099 — résultat : négatif'
    );

    const result = await ingestInboundEmail(mailDuLabo());

    expect(result.attachments[0]).toMatchObject({
      pool_reference: 'P-26-000099',
      rattachement_source: 'CONTENU_FICHIER',
      texte_lu: true,
    });
    expect(prisma.trichineDocument.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ pool_id: 'pool-P-26-000099' }),
    });
  });

  test('chaque pièce jointe est rattachée à son propre pool', async () => {
    tousLesPoolsExistent();
    vi.mocked(extractPdfText)
      .mockResolvedValueOnce('Rapport pool P-26-000045')
      .mockResolvedValueOnce('Rapport pool P-26-000046');

    const result = await ingestInboundEmail(
      mailDuLabo({
        Subject: 'Rapports du jour',
        Attachments: [
          { Name: 'a.pdf', ContentType: 'application/pdf', DownloadToken: 'a' },
          { Name: 'b.pdf', ContentType: 'application/pdf', DownloadToken: 'b' },
        ],
      })
    );

    expect(result.attachments.map((attachment) => attachment.pool_reference)).toEqual([
      'P-26-000045',
      'P-26-000046',
    ]);
  });

  test('retombe sur le sujet quand le PDF est un scan (aucun texte)', async () => {
    expediteurEstLeLaboDestinataire();
    vi.mocked(extractPdfText).mockResolvedValue(null);

    const result = await ingestInboundEmail(mailDuLabo());

    expect(result.attachments[0]).toMatchObject({
      pool_reference: 'P-26-000045',
      rattachement_source: 'EMAIL',
      texte_lu: false,
    });
  });

  test('ne lit pas le PDF quand l’expéditeur n’est pas un laboratoire connu', async () => {
    await ingestInboundEmail(mailDuLabo({ From: { Address: 'inconnu@gmail.com' } }));

    expect(extractPdfText).not.toHaveBeenCalled();
  });

  test('ne lit pas le contenu d’une image', async () => {
    expediteurEstLeLaboDestinataire();

    const result = await ingestInboundEmail(
      mailDuLabo({
        Attachments: [{ Name: 'larve.png', ContentType: 'image/png', DownloadToken: 'p' }],
      })
    );

    expect(extractPdfText).not.toHaveBeenCalled();
    expect(result.attachments[0]).toMatchObject({ statut: 'stocke', rattachement_source: 'EMAIL' });
  });
});

describe('résultat lu dans le rapport', () => {
  test('applique au pool le verdict du rapport, au nom du laboratoire expéditeur', async () => {
    tousLesPoolsExistent();
    vi.mocked(extractPdfText).mockResolvedValue(
      'Rapport COFRAC pool P-26-000045. Référence dossier : LVD44-2026-0987. Résultat : négatif.'
    );

    const result = await ingestInboundEmail(mailDuLabo());

    expect(result.resultats_appliques).toBe(1);
    expect(result.attachments[0]).toMatchObject({
      resultat_lu: 'NEGATIF',
      resultat_applique: true,
      rattachement_source: 'CONTENU_FICHIER',
    });
    expect(applyPoolResult).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-labo',
        isLnr: false,
        body: expect.objectContaining({ resultat_analyse: 'NEGATIF', reference_labo: 'lvd44-2026-0987' }),
      })
    );
  });

  test('trace dans le commentaire du pool que le résultat vient du rapport', async () => {
    tousLesPoolsExistent();
    vi.mocked(extractPdfText).mockResolvedValue('Pool P-26-000045 — Résultat : négatif');

    await ingestInboundEmail(mailDuLabo());

    const body = vi.mocked(applyPoolResult).mock.calls[0][0].body;
    expect(body.commentaire).toContain('rapport.pdf');
    expect(body.commentaire).toContain('labo@lvd.fr');
  });

  test('n’applique rien quand le rapport cite plusieurs verdicts', async () => {
    tousLesPoolsExistent();
    vi.mocked(extractPdfText).mockResolvedValue(
      'Pool P-26-000045. Résultats possibles : négatif / douteux / positif.'
    );

    const result = await ingestInboundEmail(mailDuLabo());

    expect(applyPoolResult).not.toHaveBeenCalled();
    expect(result.attachments[0]).toMatchObject({ rapport_ambigu: true, statut: 'stocke' });
    expect(result.resultats_appliques).toBe(0);
  });

  test('n’applique rien quand le rattachement vient du sujet et pas du rapport', async () => {
    expediteurEstLeLaboDestinataire();
    // Le PDF est un scan : la référence vient du sujet, le rapport n'a pas été lu
    vi.mocked(extractPdfText).mockResolvedValue(null);

    const result = await ingestInboundEmail(mailDuLabo());

    expect(result.attachments[0].rattachement_source).toBe('EMAIL');
    expect(applyPoolResult).not.toHaveBeenCalled();
  });

  test('trace le refus métier sans faire échouer le stockage', async () => {
    tousLesPoolsExistent();
    vi.mocked(extractPdfText).mockResolvedValue('Pool P-26-000045 — Résultat : négatif');
    vi.mocked(applyPoolResult).mockResolvedValue({
      kind: 'error',
      status: 400,
      error: 'Un résultat a déjà été saisi pour ce pool',
    } as never);

    const result = await ingestInboundEmail(mailDuLabo());

    expect(result.attachments[0]).toMatchObject({
      statut: 'stocke',
      resultat_lu: 'NEGATIF',
      resultat_applique: false,
      resultat_refus: 'Un résultat a déjà été saisi pour ce pool',
    });
    expect(result.resultats_appliques).toBe(0);
  });
});

describe('journal des emails entrants', () => {
  test('journalise un message traité avec le détail de ce qui a été fait', async () => {
    tousLesPoolsExistent();
    vi.mocked(extractPdfText).mockResolvedValue('Pool P-26-000045 — Résultat : négatif');

    await ingestInboundEmail(mailDuLabo());

    const call = vi.mocked(prisma.emailEntrant.upsert).mock.calls[0][0] as any;
    expect(call.where).toEqual({ message_id: '<rapport-1@lvd.fr>' });
    expect(call.create).toMatchObject({
      expediteur: 'labo@lvd.fr',
      sujet: 'Rapport d’analyse pool P-26-000045',
      statut: 'TRAITE',
      laboratoire_reconnu: true,
      nb_pieces_jointes: 1,
    });
    expect(call.create.detail.resultats_appliques).toBe(1);
  });

  test('journalise aussi un message écarté', async () => {
    await ingestInboundEmail(mailDuLabo({ SpamScore: 9 }));

    const call = vi.mocked(prisma.emailEntrant.upsert).mock.calls[0][0] as any;
    expect(call.create).toMatchObject({
      statut: 'IGNORE',
      motif_ignore: 'spam',
      laboratoire_reconnu: false,
      spam_score: 9,
    });
  });

  test('journalise une erreur de téléchargement', async () => {
    expediteurEstLeLaboDestinataire();
    vi.mocked(downloadInboundAttachment).mockResolvedValue(null);

    await ingestInboundEmail(mailDuLabo());

    const call = vi.mocked(prisma.emailEntrant.upsert).mock.calls[0][0] as any;
    expect(call.create.statut).toBe('ERREUR');
  });

  test('une écriture de journal en échec ne fait pas échouer l’ingestion', async () => {
    expediteurEstLeLaboDestinataire();
    vi.mocked(prisma.emailEntrant.upsert).mockRejectedValue(new Error('journal indisponible') as never);

    const result = await ingestInboundEmail(mailDuLabo());

    expect(result.stored).toBe(1);
  });
});

/* -------------------------------------------------------------------------- */
/* Rattachement par numéros de bracelet                                        */
/* -------------------------------------------------------------------------- */

describe('numéros de bracelet dans le texte', () => {
  test('reconnaît les n° de scellé d’un vrai rapport', () => {
    const bracelets = ['6940', '7542', '7631', '7471', '32295'];

    expect(bracelesPresentsDansTexte(RAPPORT_LVD_NEGATIF, bracelets)).toEqual(bracelets);
  });

  test('ne se reconnaît pas à l’intérieur d’un nombre plus long', () => {
    expect(bracelesPresentsDansTexte('Dossier 241108069401 du jour', ['6940'])).toEqual([]);
  });

  test('ignore les numéros trop courts pour être distinctifs', () => {
    expect(bracelesPresentsDansTexte('page 1 sur 5, lot 12', ['12', '1'])).toEqual([]);
  });

  test('reconnaît un numéro alphanumérique', () => {
    expect(bracelesPresentsDansTexte('Identification : DEMO-001', ['DEMO-001'])).toEqual(['DEMO-001']);
  });
});

describe('choisirPoolParBracelets', () => {
  const poolDe5 = { poolId: 'pool-1', reference: 'P-26-000045', bracelets: ['6940', '7542', '7631'] };
  const autrePool = { poolId: 'pool-2', reference: 'P-26-000046', bracelets: ['1111', '2222'] };

  test('retient le pool dont le rapport cite les échantillons, et voit la couverture complète', () => {
    const choix = choisirPoolParBracelets([poolDe5, autrePool], 'échantillons 6940 7542 7631');

    expect(choix).toMatchObject({ poolId: 'pool-1', total: 3, couvertureComplete: true });
    expect(choix!.trouves).toHaveLength(3);
  });

  test('signale une couverture partielle', () => {
    const choix = choisirPoolParBracelets([poolDe5], 'échantillons 6940 7542');

    expect(choix).toMatchObject({ poolId: 'pool-1', couvertureComplete: false });
  });

  test('ne tranche pas entre deux pools à égalité', () => {
    const choix = choisirPoolParBracelets(
      [poolDe5, { ...autrePool, bracelets: ['6940', '7542'] }],
      'échantillons 6940 7542'
    );

    expect(choix).toBeNull();
  });

  test('un seul numéro reconnu ne suffit pas sur un pool qui en compte plusieurs', () => {
    expect(choisirPoolParBracelets([poolDe5], 'échantillon 6940 uniquement')).toBeNull();
  });

  test('mais suffit sur un pool à échantillon unique', () => {
    const choix = choisirPoolParBracelets(
      [{ poolId: 'pool-3', reference: 'P-26-000047', bracelets: ['32295'] }],
      'échantillon 32295'
    );

    expect(choix).toMatchObject({ poolId: 'pool-3', couvertureComplete: true });
  });

  test('ne retient rien quand aucun numéro n’est cité', () => {
    expect(choisirPoolParBracelets([poolDe5, autrePool], 'aucun numéro connu ici')).toBeNull();
  });
});

describe('resultatApplicable', () => {
  const base = { kind: 'pool', id: 'pool-1', reference: 'P-26-000045' } as never;

  test('une référence explicite vaut décision', () => {
    expect(resultatApplicable({ ...(base as object), indice: 'REFERENCE_POOL' } as never)).toBe(true);
    expect(resultatApplicable({ ...(base as object), indice: 'REFERENCE_ECHANTILLON' } as never)).toBe(true);
  });

  test('des bracelets ne valent décision que si le rapport les cite tous', () => {
    const parBracelets = { ...(base as object), indice: 'NUMEROS_BRACELET' };

    expect(resultatApplicable({ ...parBracelets, couvertureComplete: true } as never)).toBe(true);
    expect(resultatApplicable({ ...parBracelets, couvertureComplete: false } as never)).toBe(false);
  });
});

describe('ingestion avec un rapport sans référence Zacharie', () => {
  test('rattache par les numéros de bracelet et applique le résultat si tous sont cités', async () => {
    vi.mocked(prisma.entityAndUserRelations.findMany).mockResolvedValue([
      { owner_id: 'user-labo', entity_id: 'entity-lvd', EntityRelatedWithUser: { is_lnr: false } },
    ] as never);
    const pool = poolFixture('P-26-000045');
    pool.TrichineEchantillons = [
      { reference_echantillon: 'E-26-000001', Carcasse: { numero_bracelet: '6940' } },
      { reference_echantillon: 'E-26-000002', Carcasse: { numero_bracelet: '7542' } },
    ];
    vi.mocked(prisma.trichinePool.findMany).mockResolvedValue([pool] as never);
    // Le rapport ne cite ni P-… ni F-… : uniquement les n° de scellé, comme les vrais rapports
    vi.mocked(extractPdfText).mockResolvedValue(
      'Échantillons 6940 et 7542 — Commentaires : analyse libératoire négative.'
    );

    const result = await ingestInboundEmail(mailDuLabo({ Subject: 'Rapport' }));

    expect(result.attachments[0]).toMatchObject({
      pool_reference: 'P-26-000045',
      rattachement_indice: 'NUMEROS_BRACELET',
      bracelets: '2/2',
      resultat_lu: 'NEGATIF',
      resultat_applique: true,
    });
  });

  test('couverture partielle : rattaché, mais le résultat reste à saisir', async () => {
    vi.mocked(prisma.entityAndUserRelations.findMany).mockResolvedValue([
      { owner_id: 'user-labo', entity_id: 'entity-lvd', EntityRelatedWithUser: { is_lnr: false } },
    ] as never);
    const pool = poolFixture('P-26-000045');
    pool.TrichineEchantillons = [
      { reference_echantillon: 'E-26-000001', Carcasse: { numero_bracelet: '6940' } },
      { reference_echantillon: 'E-26-000002', Carcasse: { numero_bracelet: '7542' } },
      { reference_echantillon: 'E-26-000003', Carcasse: { numero_bracelet: '7631' } },
    ];
    vi.mocked(prisma.trichinePool.findMany).mockResolvedValue([pool] as never);
    vi.mocked(extractPdfText).mockResolvedValue('Échantillons 6940 et 7542 — Résultat : négatif.');

    const result = await ingestInboundEmail(mailDuLabo({ Subject: 'Rapport' }));

    expect(result.attachments[0]).toMatchObject({
      pool_reference: 'P-26-000045',
      bracelets: '2/3',
    });
    expect(result.attachments[0].resultat_applique).toBeUndefined();
    expect(applyPoolResult).not.toHaveBeenCalled();
  });
});

describe('vocabulaire du laboratoire', () => {
  test('« non négatif » dans un rapport de LVD applique un DOUTEUX', async () => {
    vi.mocked(prisma.entityAndUserRelations.findMany).mockResolvedValue([
      { owner_id: 'user-labo', entity_id: 'entity-lvd', EntityRelatedWithUser: { is_lnr: false } },
    ] as never);
    vi.mocked(prisma.trichinePool.findMany).mockResolvedValue([poolFixture('P-26-000045')] as never);
    vi.mocked(extractPdfText).mockResolvedValue('Pool P-26-000045 — Recherche de Trichinella : Non négatif');

    const result = await ingestInboundEmail(mailDuLabo());

    expect(result.attachments[0]).toMatchObject({ resultat_lu: 'DOUTEUX', resultat_applique: true });
    expect(applyPoolResult).toHaveBeenCalledWith(
      expect.objectContaining({ body: expect.objectContaining({ resultat_analyse: 'DOUTEUX' }) })
    );
  });

  test('le même rapport venant du LNR reste un NON_NEGATIF', async () => {
    vi.mocked(prisma.entityAndUserRelations.findMany).mockResolvedValue([
      { owner_id: 'user-lnr', entity_id: 'entity-lnr', EntityRelatedWithUser: { is_lnr: true } },
    ] as never);
    const pool = poolFixture('P-26-000045');
    pool.TrichinePoolFTPs[0].TrichineFTP.destinataire_entity_id = 'entity-lnr';
    vi.mocked(prisma.trichinePool.findMany).mockResolvedValue([pool] as never);
    vi.mocked(extractPdfText).mockResolvedValue(
      'Pool P-26-000045 — Résultat : non négatif — parasite identifié : Trichinella britovi'
    );

    const result = await ingestInboundEmail(mailDuLabo());

    expect(result.attachments[0].resultat_lu).toBe('NON_NEGATIF');
    expect(applyPoolResult).toHaveBeenCalledWith(
      expect.objectContaining({
        isLnr: true,
        body: expect.objectContaining({
          resultat_analyse: 'NON_NEGATIF',
          parasite_identifie: 'trichinella britovi',
        }),
      })
    );
  });
});
