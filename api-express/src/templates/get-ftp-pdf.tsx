import { Document, Font, Image, Page, renderToStream, StyleSheet, Text, View } from '@react-pdf/renderer';
import bwipjs from 'bwip-js';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import path from 'path';
import prisma from '~/prisma';
import { TRICHINE_RESULTATS_EMAIL } from '~/config';

dayjs.locale('fr');

Font.register({
  family: 'Marianne',
  fonts: [
    {
      src: path.join(process.cwd(), 'src/assets/fonts/Marianne-Regular.woff'),
      fontStyle: 'normal',
      fontWeight: 'normal',
    },
    {
      src: path.join(process.cwd(), 'src/assets/fonts/Marianne-Medium.woff'),
      fontStyle: 'normal',
      fontWeight: 'medium',
    },
    {
      src: path.join(process.cwd(), 'src/assets/fonts/Marianne-Bold.woff'),
      fontStyle: 'normal',
      fontWeight: 'bold',
    },
  ],
});

const bleu = '#000096';
const gris = '#E5E5E5';

const styles = StyleSheet.create({
  page: { flexDirection: 'column', backgroundColor: '#FFFFFF', padding: 28, fontFamily: 'Marianne' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: bleu,
  },
  logoLeft: { width: 80, height: 'auto' },
  headerCenter: { flex: 1, marginHorizontal: 16 },
  headerTitle: { fontSize: 13, fontWeight: 'bold', color: bleu },
  headerSubtitle: { fontSize: 9, marginTop: 2 },
  numeroFiche: { fontSize: 16, fontWeight: 'bold' },
  logoRight: { width: 46, height: 'auto' },

  twoColumns: { flexDirection: 'row', gap: 10 },
  card: { flex: 1, borderWidth: 1, borderColor: gris, borderRadius: 3 },
  cardTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    color: bleu,
    backgroundColor: '#00009611',
    padding: 4,
    borderBottomWidth: 1,
    borderBottomColor: gris,
  },
  cardBody: { padding: 5 },
  commentaire: { marginTop: 10, borderWidth: 1, borderColor: gris, borderRadius: 3, padding: 5 },
  line: { fontSize: 9, marginBottom: 1 },
  lineStrong: { fontSize: 9, fontWeight: 'bold', marginBottom: 1 },

  consigne: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: bleu,
    borderRadius: 3,
    padding: 6,
    backgroundColor: '#00009608',
  },
  consigneTitle: { fontSize: 9, fontWeight: 'bold', color: bleu, marginBottom: 3 },
  consigneText: { fontSize: 8.5, marginBottom: 2 },

  poolBlock: { marginTop: 10, borderWidth: 1, borderColor: gris, borderRadius: 3 },
  poolHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 6,
    borderBottomWidth: 1,
    borderBottomColor: gris,
  },
  poolRef: { fontSize: 15, fontWeight: 'bold', letterSpacing: 1 },
  poolMeta: { fontSize: 8.5, marginTop: 2 },
  barcode: { width: 150, height: 'auto' },

  table: { padding: 5 },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: gris, paddingVertical: 2.5 },
  th: { fontSize: 7.5, fontWeight: 'bold', color: bleu },
  td: { fontSize: 8 },
  colEch: { width: '16%' },
  colBracelet: { width: '18%' },
  colEspece: { width: '11%' },
  colDate: { width: '12%' },
  colCommune: { width: '17%' },
  colSite: { width: '19%' },
  colMasse: { width: '7%', textAlign: 'right' },

  laboZone: { flexDirection: 'row', gap: 6, padding: 5, borderTopWidth: 1, borderTopColor: gris },
  laboField: { flex: 1, fontSize: 8, borderBottomWidth: 1, borderBottomColor: '#999999', paddingBottom: 9 },

  footer: { position: 'absolute', bottom: 14, left: 28, right: 28, fontSize: 7.5, color: '#666666' },
});

const siteLabels: Record<string, string> = {
  PILIER_DIAPHRAGME: 'Pilier diaphragme',
  LANGUE: 'Langue',
  MEMBRE_ANTERIEUR: 'Membre antérieur',
};

const typeLabels: Record<string, string> = {
  INITIAL: 'Initial',
  COMPLEMENTAIRE: 'Complémentaire (2e intention)',
  CONFIRMATION: 'Confirmation LNR',
};

// Projection identique à celle du labo (cf doc/trichine.md §10.2) : la fiche imprimée
// ne montre pas plus que ce que le laboratoire est autorisé à voir.
async function getFtpForPdf(ftpId: string) {
  return prisma.trichineFTP.findUnique({
    where: { id: ftpId },
    include: {
      ExpediteurUser: {
        select: {
          prenom: true,
          nom_de_famille: true,
          email: true,
          telephone: true,
          addresse_ligne_1: true,
          addresse_ligne_2: true,
          code_postal: true,
          ville: true,
        },
      },
      ExpediteurEntity: {
        select: {
          nom_d_usage: true,
          raison_sociale: true,
          address_ligne_1: true,
          address_ligne_2: true,
          code_postal: true,
          ville: true,
        },
      },
      DestinataireEntity: {
        select: {
          nom_d_usage: true,
          raison_sociale: true,
          address_ligne_1: true,
          address_ligne_2: true,
          code_postal: true,
          ville: true,
          is_lnr: true,
        },
      },
      TrichinePoolFTPs: {
        include: {
          TrichinePool: {
            include: {
              TrichineEchantillons: {
                where: { deleted_at: null },
                include: {
                  Carcasse: {
                    select: {
                      numero_bracelet: true,
                      espece: true,
                      date_mise_a_mort: true,
                      Fei: { select: { commune_mise_a_mort: true } },
                    },
                  },
                },
                orderBy: { reference_echantillon: 'asc' },
              },
            },
          },
        },
      },
    },
  });
}

export type FtpForPdf = NonNullable<Awaited<ReturnType<typeof getFtpForPdf>>>;

// Code 128 : les douchettes de laboratoire le saisissent directement dans le champ
// « référence client » du LIMS, sans re-frappe.
// `paddingwidth: 10` réserve la zone silencieuse de 10 modules exigée de chaque côté par
// l'ISO/IEC 15417 : sans elle, le filet de bordure du bloc pool colle aux barres et les
// lecteurs stricts refusent de décoder.
export async function barcodeDataUrl(text: string): Promise<string> {
  const png = await bwipjs.toBuffer({
    bcid: 'code128',
    text,
    scale: 3,
    height: 10,
    paddingwidth: 10,
    includetext: false,
  });
  return `data:image/png;base64,${Buffer.from(png).toString('base64')}`;
}

function formatAdresse(parts: Array<string | null>) {
  return parts.filter(Boolean).join(', ');
}

export function TrichineFtpDocument({ ftp, barcodes }: { ftp: FtpForPdf; barcodes: Record<string, string> }) {
  const logoMaasa = path.join(process.cwd(), 'src/assets/logo_MAASA.png');
  const logoZacharie = path.join(process.cwd(), 'src/assets/logo_zacharie_solo_small.png');
  const pools = ftp.TrichinePoolFTPs.map((link) => link.TrichinePool);
  const nbEchantillons = pools.reduce((total, pool) => total + pool.TrichineEchantillons.length, 0);
  const expediteurNom = ftp.ExpediteurEntity
    ? ftp.ExpediteurEntity.nom_d_usage || ftp.ExpediteurEntity.raison_sociale
    : `${ftp.ExpediteurUser.prenom} ${ftp.ExpediteurUser.nom_de_famille}`;
  const expediteurAdresse = ftp.ExpediteurEntity
    ? formatAdresse([
        ftp.ExpediteurEntity.address_ligne_1,
        ftp.ExpediteurEntity.address_ligne_2,
        ftp.ExpediteurEntity.code_postal,
        ftp.ExpediteurEntity.ville,
      ])
    : formatAdresse([
        ftp.ExpediteurUser.addresse_ligne_1,
        ftp.ExpediteurUser.addresse_ligne_2,
        ftp.ExpediteurUser.code_postal,
        ftp.ExpediteurUser.ville,
      ]);

  return (
    <Document title={`Fiche de transmission de prélèvements ${ftp.numero_fiche}`} author="Zacharie">
      <Page size="A4" style={styles.page}>
        <View style={styles.header} fixed>
          <Image style={styles.logoLeft} src={logoMaasa} />
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Fiche de transmission de prélèvements</Text>
            <Text style={styles.headerSubtitle}>
              Recherche de trichine (Trichinella spp.) — règlement (UE) 2015/1375
            </Text>
            <Text style={styles.numeroFiche}>{ftp.numero_fiche}</Text>
          </View>
          <Image style={styles.logoRight} src={logoZacharie} />
        </View>

        <View style={styles.twoColumns}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Expéditeur</Text>
            <View style={styles.cardBody}>
              <Text style={styles.lineStrong}>{expediteurNom}</Text>
              {!!expediteurAdresse && <Text style={styles.line}>{expediteurAdresse}</Text>}
              <Text style={styles.line}>
                Contact : {ftp.ExpediteurUser.prenom} {ftp.ExpediteurUser.nom_de_famille}
              </Text>
              <Text style={styles.line}>{ftp.ExpediteurUser.email}</Text>
              {!!ftp.ExpediteurUser.telephone && (
                <Text style={styles.line}>{ftp.ExpediteurUser.telephone}</Text>
              )}
            </View>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              Laboratoire destinataire {ftp.DestinataireEntity.is_lnr ? '(LNR)' : '(LVD agréé)'}
            </Text>
            <View style={styles.cardBody}>
              <Text style={styles.lineStrong}>
                {ftp.DestinataireEntity.nom_d_usage || ftp.DestinataireEntity.raison_sociale}
              </Text>
              <Text style={styles.line}>
                {formatAdresse([
                  ftp.DestinataireEntity.address_ligne_1,
                  ftp.DestinataireEntity.address_ligne_2,
                  ftp.DestinataireEntity.code_postal,
                  ftp.DestinataireEntity.ville,
                ])}
              </Text>
              <Text style={styles.line}>
                Envoi : {ftp.date_envoi ? dayjs(ftp.date_envoi).format('DD/MM/YYYY') : 'non envoyée'}
              </Text>
              {!!ftp.mode_transport && <Text style={styles.line}>Transport : {ftp.mode_transport}</Text>}
              <Text style={styles.line}>
                {pools.length} pool{pools.length > 1 ? 's' : ''} — {nbEchantillons} échantillon
                {nbEchantillons > 1 ? 's' : ''}
              </Text>
            </View>
          </View>
        </View>

        {!!ftp.commentaire && (
          <View style={styles.commentaire} wrap={false}>
            <Text style={styles.line}>Commentaire : {ftp.commentaire}</Text>
          </View>
        )}

        <View style={styles.consigne} wrap={false}>
          <Text style={styles.consigneTitle}>À l'attention du laboratoire</Text>
          <Text style={styles.consigneText}>
            1. Reportez la référence de pool ci-dessous (P-…) dans le champ « référence client » de votre LIMS
            : c'est elle qui permet de rattacher automatiquement votre résultat aux carcasses concernées. Le
            code-barres est lisible à la douchette.
          </Text>
          {!!TRICHINE_RESULTATS_EMAIL && (
            <Text style={styles.consigneText}>
              2. Renvoyez votre rapport COFRAC à {TRICHINE_RESULTATS_EMAIL} : les résultats sont intégrés
              automatiquement dans Zacharie, sans ressaisie de votre part.
            </Text>
          )}
        </View>

        {pools.map((pool) => (
          <View key={pool.id} style={styles.poolBlock} wrap={false}>
            <View style={styles.poolHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.poolRef}>{pool.reference_pool}</Text>
                <Text style={styles.poolMeta}>
                  {typeLabels[pool.type] ?? pool.type} — constitué le{' '}
                  {dayjs(pool.date_constitution).format('DD/MM/YYYY')} — {pool.TrichineEchantillons.length}{' '}
                  échantillon
                  {pool.TrichineEchantillons.length > 1 ? 's' : ''} —{' '}
                  {pool.TrichineEchantillons.reduce((total, e) => total + e.masse_grammes, 0)} g
                </Text>
              </View>
              <Image style={styles.barcode} src={barcodes[pool.reference_pool]} />
            </View>

            <View style={styles.table}>
              <View style={styles.tr}>
                <Text style={[styles.th, styles.colEch]}>Échantillon</Text>
                <Text style={[styles.th, styles.colBracelet]}>N° de marquage</Text>
                <Text style={[styles.th, styles.colEspece]}>Espèce</Text>
                <Text style={[styles.th, styles.colDate]}>Mise à mort</Text>
                <Text style={[styles.th, styles.colCommune]}>Commune</Text>
                <Text style={[styles.th, styles.colSite]}>Site</Text>
                <Text style={[styles.th, styles.colMasse]}>g</Text>
              </View>
              {pool.TrichineEchantillons.map((echantillon) => (
                <View key={echantillon.id} style={styles.tr}>
                  <Text style={[styles.td, styles.colEch]}>{echantillon.reference_echantillon}</Text>
                  <Text style={[styles.td, styles.colBracelet]}>{echantillon.Carcasse.numero_bracelet}</Text>
                  <Text style={[styles.td, styles.colEspece]}>{echantillon.Carcasse.espece}</Text>
                  <Text style={[styles.td, styles.colDate]}>
                    {echantillon.Carcasse.date_mise_a_mort
                      ? dayjs(echantillon.Carcasse.date_mise_a_mort).format('DD/MM/YYYY')
                      : ''}
                  </Text>
                  <Text style={[styles.td, styles.colCommune]}>
                    {echantillon.Carcasse.Fei?.commune_mise_a_mort ?? ''}
                  </Text>
                  <Text style={[styles.td, styles.colSite]}>
                    {siteLabels[echantillon.site_prelevement] ?? echantillon.site_prelevement}
                  </Text>
                  <Text style={[styles.td, styles.colMasse]}>{echantillon.masse_grammes}</Text>
                </View>
              ))}
            </View>

            <View style={styles.laboZone}>
              <Text style={styles.laboField}>Réservé au laboratoire — date de réception :</Text>
              <Text style={styles.laboField}>Référence labo :</Text>
              <Text style={styles.laboField}>Résultat :</Text>
            </View>
          </View>
        ))}

        <Text
          style={styles.footer}
          fixed
          render={({ pageNumber, totalPages }) =>
            `${ftp.numero_fiche} — page ${pageNumber}/${totalPages} — éditée le ${dayjs().format('DD/MM/YYYY')} via le service public Zacharie.beta.gouv.fr`
          }
        />
      </Page>
    </Document>
  );
}

/**
 * PDF de la fiche de transmission des prélèvements, imprimé par l'émetteur et joint au colis.
 * Renvoie null si la FTP n'existe pas / est supprimée.
 */
export async function getFtpPdfBuffer(ftpId: string): Promise<Buffer | null> {
  const ftp = await getFtpForPdf(ftpId);
  if (!ftp || ftp.deleted_at) return null;

  const barcodes: Record<string, string> = {};
  for (const link of ftp.TrichinePoolFTPs) {
    const reference = link.TrichinePool.reference_pool;
    barcodes[reference] = await barcodeDataUrl(reference);
  }

  const stream = await renderToStream(<TrichineFtpDocument ftp={ftp} barcodes={barcodes} />);
  const chunks: Uint8Array[] = [];
  return new Promise<Buffer>((resolve, reject) => {
    stream.on('data', (chunk: Uint8Array) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}
