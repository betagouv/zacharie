import { Image, StyleSheet, Text, View } from 'react-native';

export default function Chargement({ absolute }: { absolute?: boolean }) {
  return (
    <View style={[styles.container, absolute ? styles.absolute : {}]}>
      <View style={styles.logosRow}>
        <Image
          source={require('../assets/mariane_zacharie.png')}
          style={styles.marianeLogo}
          resizeMode="contain"
        />
      </View>

      <View style={styles.divider1} />

      <Text style={styles.brand}>Zacharie</Text>
      <Text style={styles.tagline}>Garantir des viandes de gibier sauvage saines et sûres</Text>

      <View style={styles.divider} />

      <View style={styles.loadingBlock}>
        <Text style={styles.title}>Chargement en cours…</Text>
        <Text style={styles.lead}>Veuillez patienter, Zach'arrive !</Text>
        <Text style={styles.lead2}>Zacharie prépare l'application sur votre téléphone.</Text>
        <Text style={styles.lead2}>
          Cela peut prendre une minute la première fois. Ensuite, vous pourrez l'utiliser même sans connexion
          internet, au cœur des bois.
        </Text>
      </View>
      <View style={styles.logoBlock}>
        <Image source={require('../assets/icon_512.png')} style={styles.logo2} resizeMode="contain" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 12,
  },
  absolute: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  logosRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  logo2: {
    width: 100,
    height: 100,
  },
  logoBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
  },
  marianeLogo: {
    width: 150,
    height: 80,
  },
  zacharieLogo: {
    width: 56,
    height: 64,
  },
  divider1: {
    marginHorizontal: 16,
    height: 1,
    backgroundColor: '#e5e5e5',
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e5e5',
    marginVertical: 8,
  },
  brand: {
    fontFamily: 'Marianne-Bold',
    fontSize: 18,
    color: '#161616',
    marginTop: 8,
    paddingHorizontal: 16,
  },
  tagline: {
    fontFamily: 'Marianne-Regular',
    fontSize: 14,
    color: '#161616',
    lineHeight: 24,
    marginTop: 4,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  loadingBlock: {
    marginTop: 48,
    paddingHorizontal: 24,
  },
  title: {
    fontFamily: 'Marianne-Bold',
    fontSize: 32,
    color: '#161616',
    lineHeight: 40,
  },
  lead: {
    fontFamily: 'Marianne-Medium',
    fontSize: 18,
    color: '#161616',
    marginVertical: 24,
    lineHeight: 26,
  },
  lead2: {
    fontFamily: 'Marianne-Regular',
    fontSize: 14,
    color: '#161616',
    marginTop: 8,
    lineHeight: 20,
  },
});
