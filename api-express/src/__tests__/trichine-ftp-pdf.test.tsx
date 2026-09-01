import { describe, test, expect, vi } from 'vitest';
import { TrichineSitePrelevement, TrichineStatutLogistiqueFTP, TrichineType } from '@prisma/client';
import prisma from '~/prisma';
import { barcodeDataUrl, getFtpPdfBuffer, type FtpForPdf } from '~/templates/get-ftp-pdf';
import { archiveFtpPdf, getArchivedOrFreshFtpPdf } from '~/utils/trichine-ftp-document';

export const ftpFixture = {
  id: 'ftp-1',
  numero_fiche: 'F-26-000012',
  date_creation: new Date('2026-08-10T08:00:00Z'),
  date_envoi: new Date('2026-08-12T08:00:00Z'),
  statut_logistique: TrichineStatutLogistiqueFTP.ENVOYEE,
  mode_transport: 'Coursier — glacière 4°C',
  commentaire: 'Colis déposé à 9h à l’accueil du laboratoire.',
  deleted_at: null,
  ExpediteurUser: {
    prenom: 'Camille',
    nom_de_famille: 'Dubois',
    email: 'camille.dubois@example.fr',
    telephone: '0601020304',
    addresse_ligne_1: '12 rue des Chasseurs',
    addresse_ligne_2: null,
    code_postal: '35000',
    ville: 'Rennes',
  },
  ExpediteurEntity: {
    nom_d_usage: 'ETG Bretagne Venaison',
    raison_sociale: 'SARL Bretagne Venaison',
    address_ligne_1: 'ZA de la Lande',
    address_ligne_2: null,
    code_postal: '35510',
    ville: 'Cesson-Sévigné',
  },
  DestinataireEntity: {
    nom_d_usage: 'LVD 35 — Laboratoire départemental',
    raison_sociale: 'Département Ille-et-Vilaine',
    address_ligne_1: '9 rue du Clos Courtel',
    address_ligne_2: null,
    code_postal: '35700',
    ville: 'Rennes',
    is_lnr: false,
  },
  TrichinePoolFTPs: [
    {
      TrichinePool: {
        id: 'pool-1',
        reference_pool: 'P-26-000045',
        type: TrichineType.INITIAL,
        date_constitution: new Date('2026-08-11T00:00:00Z'),
        TrichineEchantillons: [
          {
            id: 'ech-1',
            reference_echantillon: 'E-26-000101',
            site_prelevement: TrichineSitePrelevement.PILIER_DIAPHRAGME,
            masse_grammes: 5,
            Carcasse: {
              numero_bracelet: 'FR-35-2026-0001',
              espece: 'Sanglier',
              date_mise_a_mort: new Date('2026-08-09T00:00:00Z'),
              Fei: { commune_mise_a_mort: 'Paimpont' },
            },
          },
          {
            id: 'ech-2',
            reference_echantillon: 'E-26-000102',
            site_prelevement: TrichineSitePrelevement.LANGUE,
            masse_grammes: 5,
            Carcasse: {
              numero_bracelet: 'FR-35-2026-0002',
              espece: 'Sanglier',
              date_mise_a_mort: new Date('2026-08-09T00:00:00Z'),
              Fei: { commune_mise_a_mort: 'Paimpont' },
            },
          },
        ],
      },
    },
  ],
} as unknown as FtpForPdf;

describe('getFtpPdfBuffer', () => {
  test('rend un PDF pour une FTP existante', async () => {
    vi.mocked(prisma.trichineFTP.findUnique).mockResolvedValueOnce(ftpFixture as never);

    const pdf = await getFtpPdfBuffer('ftp-1');

    expect(pdf).toBeInstanceOf(Buffer);
    expect(pdf!.subarray(0, 5).toString()).toBe('%PDF-');
  }, 30000);

  test('FTP supprimée → null', async () => {
    vi.mocked(prisma.trichineFTP.findUnique).mockResolvedValueOnce({
      ...ftpFixture,
      deleted_at: new Date(),
    } as never);

    expect(await getFtpPdfBuffer('ftp-1')).toBeNull();
  });

  test('la référence du pool est encodée en Code 128', async () => {
    const dataUrl = await barcodeDataUrl('P-26-000045');
    expect(dataUrl.startsWith('data:image/png;base64,')).toBe(true);
  });

  test('le code-barres embarque sa zone silencieuse de 10 modules de chaque côté', async () => {
    const png = Buffer.from((await barcodeDataUrl('P-26-000045')).split(',')[1], 'base64');
    // largeur PNG lue dans l'IHDR ; `scale: 3` = 3 pixels par module
    const modules = png.readUInt32BE(16) / 3;
    // P-26-000045 tient sur 11 symboles Code 128 (11 modules chacun) + le stop (13)
    expect(modules).toBe(11 * 11 + 13 + 2 * 10);
  });
});

// Cellar n'est pas configuré en test : le PDF est régénéré à la demande, rien n'est archivé
describe('archivage du PDF sans Cellar', () => {
  test('archiveFtpPdf rend le PDF sans créer de document', async () => {
    vi.mocked(prisma.trichineFTP.findUnique).mockResolvedValueOnce(ftpFixture as never);

    const pdf = await archiveFtpPdf('ftp-1', 'user-1');

    expect(pdf!.subarray(0, 5).toString()).toBe('%PDF-');
    expect(prisma.trichineDocument.create).not.toHaveBeenCalled();
  }, 30000);

  test('getArchivedOrFreshFtpPdf régénère sans lire le stockage', async () => {
    vi.mocked(prisma.trichineFTP.findUnique).mockResolvedValueOnce(ftpFixture as never);

    const pdf = await getArchivedOrFreshFtpPdf('ftp-1');

    expect(pdf!.subarray(0, 5).toString()).toBe('%PDF-');
    expect(prisma.trichineDocument.findFirst).not.toHaveBeenCalled();
  }, 30000);
});
