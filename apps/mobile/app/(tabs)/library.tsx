import { View, Text, StyleSheet } from 'react-native';
import { colors, typography } from '@/constants/theme';

// Placeholder. Library accueillera trois sous-onglets — Projects, Playlists,
// Liked — qui viendront avec la construction de l'écran, pas ici.
export default function LibraryScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Library</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  title: {
    // fontFamily et non fontWeight : la graisse d'une police custom se choisit
    // par la variante (cf. commentaire de typography). Un fontWeight seul
    // retombe silencieusement sur la police système.
    fontFamily: typography.family.heading,
    fontSize: typography.size.xl,
    color: colors.text,
  },
});
