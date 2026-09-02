import { describe, test, expect, vi, beforeEach } from 'vitest';
import prisma from '~/prisma';
import {
  dedupeAttachmentsByName,
  documentTypeForAttachment,
  extractFtpReferences,
  extractPoolReferences,
  ingestInboundEmail,
  inboundEmailPayloadSchema,
  isSupportedAttachment,
  messageIdFromItem,
  normalizeContentType,
  searchableTextFromItem,
  type InboundEmailItem,
} from '~/utils/trichine-inbound-email';
import { downloadInboundAttachment } from '~/third-parties/brevo-inbound';
import { uploadToCellar } from '~/third-parties/cellar';

vi.mock('~/third-parties/sentry', () => ({ capture: vi.fn() }));
vi.mock('~/third-parties/brevo-inbound', () => ({
  downloadInboundAttachment: vi.fn().mockResolvedValue(Buffer.from('%PDF-1.4 rapport')),
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

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(downloadInboundAttachment).mockResolvedValue(Buffer.from('%PDF-1.4 rapport'));
  vi.mocked(prisma.trichineDocument.findFirst).mockResolvedValue(null as never);
  vi.mocked(prisma.trichineDocument.create).mockResolvedValue({ id: 'doc-1' } as never);
  vi.mocked(prisma.trichineDocument.update).mockResolvedValue({ id: 'doc-1' } as never);
  vi.mocked(prisma.entityAndUserRelations.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.trichinePool.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.trichineFTP.findMany).mockResolvedValue([] as never);
});

function expediteurEstLeLaboDestinataire() {
  vi.mocked(prisma.entityAndUserRelations.findMany).mockResolvedValue([{ entity_id: 'entity-lvd' }] as never);
  vi.mocked(prisma.trichinePool.findMany).mockResolvedValue([
    { id: 'pool-1', reference_pool: 'P-26-000045' },
  ] as never);
}

describe('ingestInboundEmail', () => {
  test('rattache le rapport au pool quand l’expéditeur est le laboratoire destinataire', async () => {
    expediteurEstLeLaboDestinataire();

    const result = await ingestInboundEmail(mailDuLabo());

    expect(result).toMatchObject({ stored: 1, skipped: 0, failed: 0, pool_reference: 'P-26-000045' });
    expect(uploadToCellar).toHaveBeenCalledOnce();
    expect(prisma.trichineDocument.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'RAPPORT_COFRAC',
        source: 'EMAIL',
        ajoute_par_user_id: null,
        pool_id: 'pool-1',
        nom_fichier: 'rapport.pdf',
        email_message_id: '<rapport-1@lvd.fr>',
        email_expediteur: 'labo@lvd.fr',
      }),
    });
  });

  test('stocke sans rattachement quand le pool n’est pas destiné à l’expéditeur', async () => {
    vi.mocked(prisma.entityAndUserRelations.findMany).mockResolvedValue([
      { entity_id: 'entity-autre-labo' },
    ] as never);
    // Le pool existe mais aucune FTP ne le destine à ce laboratoire : la requête ne renvoie rien
    vi.mocked(prisma.trichinePool.findMany).mockResolvedValue([] as never);

    const result = await ingestInboundEmail(mailDuLabo());

    expect(result).toMatchObject({ stored: 1 });
    expect(result.pool_reference).toBeUndefined();
    expect(prisma.trichineDocument.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ pool_id: undefined, ftp_id: undefined }),
    });
  });

  test('ne rattache rien si l’expéditeur n’est pas un utilisateur laboratoire', async () => {
    const result = await ingestInboundEmail(mailDuLabo({ From: { Address: 'inconnu@gmail.com' } }));

    expect(result).toMatchObject({ stored: 1 });
    expect(result.pool_reference).toBeUndefined();
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
    expect(downloadInboundAttachment).not.toHaveBeenCalled();
    expect(prisma.trichineDocument.create).not.toHaveBeenCalled();
  });

  test('compte un échec quand le téléchargement de la pièce jointe échoue', async () => {
    expediteurEstLeLaboDestinataire();
    vi.mocked(downloadInboundAttachment).mockResolvedValue(null);

    const result = await ingestInboundEmail(mailDuLabo());

    expect(result).toMatchObject({ stored: 0, failed: 1 });
    expect(prisma.trichineDocument.create).not.toHaveBeenCalled();
  });
});
