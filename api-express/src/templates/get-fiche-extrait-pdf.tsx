import { Document, Image, Page, renderToStream, StyleSheet, Text, View } from '@react-pdf/renderer';
import dayjs from 'dayjs';
import path from 'path';

// Extrait de fiche téléchargé par le SVI ou l'ETG pour le joindre à un courrier : simple copie de ce
// que Zacharie affiche, sans valeur de document officiel (pas de bloc-marque de l'État).
export type FicheExtraitData = {
  numero: string;
  dateMiseAMort: Date | null;
  communeMiseAMort: string | null;
  examinateur: string | null;
  premierDetenteur: string | null;
  intermediaires: Array<{ nom: string; role: string; priseEnChargeAt: Date | null }>;
  svi: string | null;
  carcasses: Array<{
    numeroBracelet: string;
    espece: string | null;
    nombreAnimaux: number | null;
    statut: string;
  }>;
  genereLe: Date;
};

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: 'Helvetica', color: '#161616' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  logo: { width: 32, height: 32, marginRight: 12 },
  title: { fontSize: 16, fontFamily: 'Helvetica-Bold' },
  subtitle: { fontSize: 9, color: '#666666', marginTop: 2 },
  sectionTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginTop: 16, marginBottom: 6 },
  line: { flexDirection: 'row', marginBottom: 3 },
  label: { width: 150, color: '#3a3a3a' },
  value: { flex: 1 },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#eeeeee',
    fontFamily: 'Helvetica-Bold',
    paddingVertical: 4,
  },
  tableRow: { flexDirection: 'row', borderBottom: '1px solid #dddddd', paddingVertical: 4 },
  colBracelet: { width: '30%', paddingHorizontal: 4 },
  colEspece: { width: '25%', paddingHorizontal: 4 },
  colNombre: { width: '10%', paddingHorizontal: 4 },
  colStatut: { width: '35%', paddingHorizontal: 4 },
  footer: { position: 'absolute', bottom: 20, left: 32, right: 32, fontSize: 8, color: '#666666' },
});

function formatDate(date: Date | null) {
  return date ? dayjs(date).format('DD/MM/YYYY') : '-';
}

function Ligne({ label, value }: { label: string; value: string | null }) {
  return (
    <View style={styles.line}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value || '-'}</Text>
    </View>
  );
}

export function FicheExtraitDocument({ fiche }: { fiche: FicheExtraitData }) {
  return (
    <Document title={`Fiche ${fiche.numero}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Image
            src={path.join(process.cwd(), 'src/assets/logo_zacharie_solo_small.png')}
            style={styles.logo}
          />
          <View>
            <Text style={styles.title}>Fiche {fiche.numero}</Text>
            <Text style={styles.subtitle}>Extrait de Zacharie, document non officiel</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Données de chasse</Text>
        <Ligne
          label="Date de mise à mort"
          value={formatDate(fiche.dateMiseAMort)}
        />
        <Ligne
          label="Commune de mise à mort"
          value={fiche.communeMiseAMort}
        />
        <Ligne
          label="Examinateur initial"
          value={fiche.examinateur}
        />
        <Ligne
          label="Premier détenteur"
          value={fiche.premierDetenteur}
        />

        <Text style={styles.sectionTitle}>Traçabilité</Text>
        {fiche.intermediaires.map((intermediaire, index) => (
          <Ligne
            key={index}
            label={intermediaire.role}
            value={`${intermediaire.nom} (pris en charge le ${formatDate(intermediaire.priseEnChargeAt)})`}
          />
        ))}
        <Ligne
          label="Service vétérinaire"
          value={fiche.svi}
        />

        <Text style={styles.sectionTitle}>Carcasses ({fiche.carcasses.length})</Text>
        <View style={styles.tableHeader}>
          <Text style={styles.colBracelet}>N° d'identification</Text>
          <Text style={styles.colEspece}>Espèce</Text>
          <Text style={styles.colNombre}>Nombre</Text>
          <Text style={styles.colStatut}>Statut</Text>
        </View>
        {fiche.carcasses.map((carcasse, index) => (
          <View
            key={index}
            style={styles.tableRow}
            wrap={false}
          >
            <Text style={styles.colBracelet}>{carcasse.numeroBracelet}</Text>
            <Text style={styles.colEspece}>{carcasse.espece || '-'}</Text>
            <Text style={styles.colNombre}>{carcasse.nombreAnimaux ?? '-'}</Text>
            <Text style={styles.colStatut}>{carcasse.statut}</Text>
          </View>
        ))}

        <Text
          style={styles.footer}
          fixed
          render={({ pageNumber, totalPages }) =>
            `Extrait généré le ${dayjs(fiche.genereLe).format('DD/MM/YYYY à HH:mm')} — page ${pageNumber}/${totalPages}`
          }
        />
      </Page>
    </Document>
  );
}

export async function getFicheExtraitPdfBuffer(fiche: FicheExtraitData): Promise<Buffer> {
  const stream = await renderToStream(<FicheExtraitDocument fiche={fiche} />);
  const chunks: Uint8Array[] = [];
  return new Promise<Buffer>((resolve, reject) => {
    stream.on('data', (chunk: Uint8Array) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}
