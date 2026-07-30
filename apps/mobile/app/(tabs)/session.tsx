import { View, Text, StyleSheet } from 'react-native';
import { colors, typography } from '@/constants/theme';

// Placeholder plein écran — pas un modal : Session est un onglet de premier
// niveau, on doit pouvoir en sortir et y revenir sans perdre son état.
// C'est ici que vivra l'appairage de la board, qui occupait l'onglet Connect.
export default function SessionScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Session</Text>
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
    fontFamily: typography.family.heading,
    fontSize: typography.size.xl,
    color: colors.text,
  },
});
