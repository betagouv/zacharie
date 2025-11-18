import { Carcasse, Entity, EntityRelationStatus, EntityRelationType, Fei, User } from '@prisma/client';
import { Document, Font, Image, Page, renderToStream, StyleSheet, Text, View } from '@react-pdf/renderer';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
dayjs.locale('fr');
import path from 'path';
import prisma from '~/prisma';
import { getEntityDisplay } from '~/utils/get-entity-display';

Font.register({
  family: 'Marianne',
  fonts: [
    {
      src: path.join(process.cwd(), 'src/assets/fonts/Marianne-Light.woff'),
      fontStyle: 'normal',
      fontWeight: 'light',
    },
    {
      src: path.join(process.cwd(), 'src/assets/fonts/Marianne-Light_Italic.woff'),
      fontStyle: 'italic',
      fontWeight: 'light',
    },
    {
      src: path.join(process.cwd(), 'src/assets/fonts/Marianne-Regular.woff'),
      fontStyle: 'normal',
      fontWeight: 'normal',
    },
    {
      src: path.join(process.cwd(), 'src/assets/fonts/Marianne-Regular_Italic.woff'),
      fontStyle: 'italic',
      fontWeight: 'normal',
    },
    {
      src: path.join(process.cwd(), 'src/assets/fonts/Marianne-Medium.woff'),
      fontStyle: 'normal',
      fontWeight: 'medium',
    },
    {
      src: path.join(process.cwd(), 'src/assets/fonts/Marianne-Medium_Italic.woff'),
      fontStyle: 'italic',
      fontWeight: 'medium',
    },
    {
      src: path.join(process.cwd(), 'src/assets/fonts/Marianne-Bold.woff'),
      fontStyle: 'normal',
      fontWeight: 'bold',
    },
    {
      src: path.join(process.cwd(), 'src/assets/fonts/Marianne-Bold_Italic.woff'),
      fontStyle: 'italic',
      fontWeight: 'bold',
    },
  ],
});

Font.register({
  family: 'Spectral',
  fonts: [
    {
      src: path.join(process.cwd(), 'src/assets/fonts/Spectral-Regular.woff'),
      fontStyle: 'normal',
      fontWeight: 'normal',
    },
    {
      src: path.join(process.cwd(), 'src/assets/fonts/Spectral-ExtraBold.woff'),
      fontStyle: 'normal',
      fontWeight: 'bold',
    },
  ],
});

const fontXl = 20;
const fontLg = 16;
const fontBase = 14;
const fontSm = 12;
const fontXs = 10;

const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
    padding: 30,
    fontFamily: 'Marianne',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginBottom: 20,
    // paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#000096',
  },
  logoLeft: {
    width: 100,
    height: 'auto',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'flex-start',
    marginHorizontal: 20,
  },
  headerTitle: {
    fontSize: fontBase,
    fontWeight: 'bold',
    fontFamily: 'Marianne',
    textAlign: 'left',
  },
  title: {
    fontSize: fontLg,
    fontWeight: 'bold',
    fontFamily: 'Marianne',
    textAlign: 'left',
  },
  titleSection: {
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  description: {
    fontSize: fontSm,
    textAlign: 'left',
  },
  logoRight: {
    width: 60,
    height: 'auto',
  },
  section: {
    margin: 10,
    padding: 10,
    flexGrow: 1,
  },
  sectionHeader: {
    fontSize: fontBase,
    fontWeight: 'bold',
    fontFamily: 'Marianne',
    textAlign: 'left',
    marginBottom: 10,
    marginTop: 20,
  },
  twoColumnSection: {
    flexDirection: 'row',
    gap: 15,
    // border: '1px solid red',
  },
  column: {
    flexShrink: 0,
    flexGrow: 1,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 4,
    // border: '1px solid green',
  },
  columnTitle: {
    fontSize: fontBase,
    fontWeight: 'bold',
    fontFamily: 'Marianne',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
    backgroundColor: '#00009611',
    color: '#000096',
    padding: 5,
  },
  fieldValue: {
    fontSize: fontXs,
    fontFamily: 'Marianne',
    color: '#000000',
    padding: 5,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  borderLess: {
    borderTopWidth: 0,
  },
  paddingLess: {
    padding: 0,
  },
  leftFieldValue: {
    borderRightWidth: 1,
    borderRightColor: '#E5E5E5',
  },
  row: {
    flexDirection: 'column',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 4,
  },
  rowWithMultipleText: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowContent: {
    flexGrow: 1,
  },
  rowHeader: {
    fontWeight: 'bold',
    textAlign: 'center',
  },
  footer: {
    fontSize: fontXs,
    fontFamily: 'Marianne',
    color: '#000000',
    marginBottom: 10,
  },
});

export async function getFichePdf(fei: Fei) {
  const logoMaasaPath = path.join(process.cwd(), 'src/assets/logo_MAASA.png');
  const logoZachariePath = path.join(process.cwd(), 'src/assets/logo_zacharie_solo_small.png');

  const carcasses = await prisma.carcasse.findMany({
    where: {
      fei_numero: fei.numero,
      deleted_at: null,
    },
  });
  let premierDetenteurEntity: Entity | null = null;
  if (fei.premier_detenteur_entity_id) {
    premierDetenteurEntity = await prisma.entity.findUnique({
      where: {
        id: fei.premier_detenteur_entity_id,
      },
    });
  }
  const premierDetenteurUser = await prisma.user.findUnique({
    where: {
      id: fei.premier_detenteur_user_id,
    },
  });
  const address_ligne_1 = premierDetenteurEntity
    ? premierDetenteurEntity!.address_ligne_1
    : premierDetenteurUser!.addresse_ligne_1;
  const address_ligne_2 = premierDetenteurEntity
    ? premierDetenteurEntity!.address_ligne_2
    : premierDetenteurUser!.addresse_ligne_1;
  const code_postal = premierDetenteurEntity
    ? premierDetenteurEntity!.code_postal
    : premierDetenteurUser!.code_postal;
  const ville = premierDetenteurEntity ? premierDetenteurEntity!.ville : premierDetenteurUser!.ville;
  const examinateurInitialUser = await prisma.user.findUnique({
    where: {
      id: fei.examinateur_initial_user_id,
    },
  });
  const destinataireFinalEntity = await prisma.entity.findUnique({
    where: {
      id: fei.fei_next_owner_entity_id,
    },
  });
  let destinataireFinalUser: User | null = null;
  if (fei.fei_next_owner_user_id) {
    destinataireFinalUser = await prisma.user.findUnique({
      where: {
        id: fei.fei_next_owner_user_id,
      },
    });
  } else {
    destinataireFinalUser = await prisma.entityAndUserRelations
      .findFirst({
        where: {
          entity_id: fei.fei_next_owner_entity_id,
          relation: EntityRelationType.CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY,
          status: { in: [EntityRelationStatus.MEMBER, EntityRelationStatus.ADMIN] },
        },
        include: {
          UserRelatedWithEntity: true,
        },
      })
      .then((relation) => relation.UserRelatedWithEntity);
  }
  let centreDeCollecteEntity: Entity | null = null;
  let centreDeCollecteAdresse = '';
  if (fei.premier_detenteur_depot_entity_id) {
    centreDeCollecteEntity = await prisma.entity.findUnique({
      where: {
        id: fei.premier_detenteur_depot_entity_id,
      },
    });
    centreDeCollecteAdresse = `${centreDeCollecteEntity!.address_ligne_1}`;
    if (centreDeCollecteEntity!.address_ligne_2) {
      centreDeCollecteAdresse += `\n${centreDeCollecteEntity!.address_ligne_2}`;
    }
    centreDeCollecteAdresse += `\n${centreDeCollecteEntity!.code_postal} ${centreDeCollecteEntity!.ville}`;
  }

  const MyDocument = () => (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Image src={logoMaasaPath} style={styles.logoLeft} />
          <Image src={logoZachariePath} style={styles.logoRight} />
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Zacharie</Text>
            <Text style={styles.description}>Garantir des viandes de gibier sauvage saines et sûres</Text>
          </View>
        </View>
        <View style={styles.titleSection}>
          <Text style={styles.title}>FICHE D'EXAMEN INITIAL N° {fei.numero}</Text>
        </View>
        {/* Two-column section: Premier détenteur & Destinataire final */}
        <Text style={styles.sectionHeader}>Circuit des carcasses en peau</Text>
        <View style={styles.twoColumnSection} wrap={false}>
          {/* Left column: Premier détenteur */}
          <View style={styles.column}>
            <Text style={[styles.columnTitle, styles.borderLess]}>Premier détenteur</Text>

            {premierDetenteurEntity?.nom_d_usage && (
              <Text style={styles.fieldValue}>{premierDetenteurEntity.nom_d_usage}</Text>
            )}

            <Text style={styles.fieldValue}>
              {premierDetenteurUser!.prenom} {premierDetenteurUser!.nom_de_famille}
            </Text>

            <View style={[styles.fieldValue]}>
              <Text style={[styles.fieldValue, styles.borderLess, styles.paddingLess]}>Adresse :</Text>
              <Text style={[styles.fieldValue, styles.borderLess, styles.paddingLess]}>
                {address_ligne_1}
              </Text>
              {!!address_ligne_2 && (
                <Text style={[styles.fieldValue, styles.borderLess, styles.paddingLess]}>
                  {address_ligne_2}
                </Text>
              )}
              <Text style={[styles.fieldValue, styles.borderLess, styles.paddingLess]}>
                {code_postal} {ville}
              </Text>
            </View>
            <Text style={styles.fieldValue}>Tel : {premierDetenteurUser!.telephone}</Text>
            <Text style={styles.fieldValue}>Email : {premierDetenteurUser!.email}</Text>
          </View>

          {/* Right column: Destinataire final */}
          <View style={styles.column}>
            <Text style={[styles.columnTitle, styles.borderLess]}>
              {/* Destinataire final ({getEntityDisplay(destinataireFinalEntity!.type)}) */}
              {getEntityDisplay(destinataireFinalEntity!.type)}
            </Text>

            <Text style={styles.fieldValue}>{destinataireFinalEntity!.nom_d_usage}</Text>

            <Text style={styles.fieldValue}>
              {destinataireFinalUser!.prenom} {destinataireFinalUser!.nom_de_famille}
            </Text>

            <View style={[styles.fieldValue]}>
              <Text style={[styles.fieldValue, styles.borderLess, styles.paddingLess]}>Adresse :</Text>
              <Text style={[styles.fieldValue, styles.borderLess, styles.paddingLess]}>
                {destinataireFinalEntity!.address_ligne_1}
              </Text>
              {!!destinataireFinalEntity!.address_ligne_2 && (
                <Text style={[styles.fieldValue, styles.borderLess, styles.paddingLess]}>
                  {destinataireFinalEntity!.address_ligne_2}
                </Text>
              )}
              <Text style={[styles.fieldValue, styles.borderLess, styles.paddingLess]}>
                {destinataireFinalEntity!.code_postal} {destinataireFinalEntity!.ville}
              </Text>
            </View>
            <Text style={styles.fieldValue}>Tel : {destinataireFinalUser!.telephone}</Text>
            <Text style={styles.fieldValue}>Email : {destinataireFinalUser!.email}</Text>
          </View>
        </View>
        <Text style={styles.sectionHeader}>Concernant les carcasses ou lots d’animaux suivant(e)s :</Text>
        {carcasses.map((carcasse) => {
          return (
            <View style={styles.row} key={carcasse.zacharie_carcasse_id} wrap={false}>
              <View style={styles.rowWithMultipleText}>
                <Text
                  style={[styles.rowContent, styles.fieldValue, styles.borderLess, styles.leftFieldValue]}
                >
                  Espèce : {carcasse.espece}
                </Text>
                <Text style={[styles.rowContent, styles.fieldValue, styles.borderLess]}>
                  Nombre d'animaux : {carcasse.nombre_d_animaux}
                </Text>
              </View>
              <Text style={[styles.rowContent, styles.fieldValue]}>
                N° d'identification : {carcasse.numero_bracelet}
              </Text>
              {!!carcasse.examinateur_anomalies_abats?.length && (
                <Text style={[styles.rowContent, styles.fieldValue]}>
                  Anomalies abats :{'\n'}
                  {carcasse.examinateur_anomalies_abats.join('\n')}
                </Text>
              )}
              {!!carcasse.examinateur_anomalies_carcasse?.length && (
                <Text style={[styles.rowContent, styles.fieldValue]}>
                  Anomalies carcasse :{'\n'}
                  {carcasse.examinateur_anomalies_carcasse.join('\n')}
                </Text>
              )}
              {!!carcasse.examinateur_commentaire?.length && (
                <Text style={[styles.rowContent, styles.fieldValue]}>
                  Commentaire :{'\n'}
                  {carcasse.examinateur_commentaire}
                </Text>
              )}
            </View>
          );
        })}
        <Text style={styles.sectionHeader}>
          Informations concernant la traçabilité de ces carcasses ou lots d’animaux :
        </Text>
        <View style={styles.row} wrap={false}>
          <Text style={[styles.rowContent, styles.fieldValue, styles.borderLess, styles.rowHeader]}>
            Date de la chasse : {dayjs(fei.date_mise_a_mort).format('dddd D MMMM YYYY')}
          </Text>
          <View style={styles.rowWithMultipleText}>
            <Text style={[styles.rowContent, styles.fieldValue, styles.leftFieldValue]}>
              Commune de la chasse : {fei.commune_mise_a_mort.split(' ').slice(1).join(' ')}
            </Text>
            <Text style={[styles.rowContent, styles.fieldValue]}>
              Code postal: {fei.commune_mise_a_mort.split(' ')[0]}
            </Text>
          </View>
          <View style={styles.rowWithMultipleText}>
            <Text
              style={[
                styles.rowContent,
                styles.fieldValue,
                fei.heure_evisceration_derniere_carcasse ? styles.leftFieldValue : {},
              ]}
            >
              Heure de première mise à mort : {fei.heure_mise_a_mort_premiere_carcasse}
            </Text>
            {fei.heure_evisceration_derniere_carcasse && (
              <Text style={[styles.rowContent, styles.fieldValue]}>
                Heure de dernière éviscération : {fei.heure_evisceration_derniere_carcasse}
              </Text>
            )}
          </View>
        </View>
        {fei.premier_detenteur_depot_entity_id && (
          <View style={styles.row} wrap={false}>
            <Text style={[styles.rowContent, styles.fieldValue, styles.borderLess, styles.rowHeader]}>
              Centre de collecte
            </Text>
            <View style={styles.rowWithMultipleText}>
              <Text style={[styles.rowContent, styles.fieldValue, styles.leftFieldValue]}>
                Nom usuel : {fei.premier_detenteur_depot_entity_name_cache}
              </Text>
              <Text style={[styles.rowContent, styles.fieldValue]}>
                N° identification: {centreDeCollecteEntity.numero_ddecpp}
              </Text>
            </View>
            <Text style={[styles.rowContent, styles.fieldValue, styles.borderLess, styles.rowHeader]}>
              Adresse:{'\n'}
              {centreDeCollecteAdresse}
            </Text>
          </View>
        )}
        <View style={styles.row} wrap={false}>
          <Text style={[styles.rowContent, styles.fieldValue, styles.borderLess, styles.rowHeader]}>
            Examinateur initial
          </Text>
          <Text style={[styles.rowContent, styles.fieldValue, styles.leftFieldValue]}>
            Prénom et nom : {examinateurInitialUser!.prenom} {examinateurInitialUser!.nom_de_famille}
          </Text>
          <Text style={[styles.rowContent, styles.fieldValue]}>
            N° d'examinateur: {examinateurInitialUser!.numero_cfei}
          </Text>
          <View style={styles.rowWithMultipleText}>
            <Text style={[styles.rowContent, styles.fieldValue, styles.leftFieldValue]}>
              Tel : {examinateurInitialUser!.telephone}
            </Text>
            <Text style={[styles.rowContent, styles.fieldValue]}>
              Email : {examinateurInitialUser!.email}
            </Text>
          </View>
        </View>
        <Text style={styles.footer}>
          L’examinateur initial susnommé a certifié le{' '}
          {dayjs(fei.examinateur_initial_date_approbation_mise_sur_le_marche).format('DD MMMM YYYY')} que les
          carcasses en peau examinées peuvent être mises sur le marché (sous réserve de résultats trichine
          négatifs).
        </Text>
        <Text style={styles.footer}>
          Signé électroniquement, le{' '}
          {dayjs(fei.examinateur_initial_date_approbation_mise_sur_le_marche).format('DD/MM/YYYY à HH:mm')},
          via le service public Zacharie.beta.gouv.fr
        </Text>
      </Page>
    </Document>
  );

  const stream = await renderToStream(<MyDocument />);

  const chunks: Uint8Array[] = [];
  return new Promise<string>((resolve, reject) => {
    stream.on('data', (chunk: Uint8Array) => chunks.push(chunk));
    stream.on('end', () => {
      const buffer = Buffer.concat(chunks);
      const base64 = buffer.toString('base64');
      resolve(base64);
    });
    stream.on('error', reject);
  });
}
