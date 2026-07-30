import { View, Text, StyleSheet, Pressable } from 'react-native';
import { colors, spacing, typography, radii } from '@/constants/theme';
import { useAuth } from '@/lib/auth/AuthContext';

export default function ProfileScreen() {
  const { logout } = useAuth();

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Profile</Text>
      </View>

      <Pressable
        onPress={logout}
        style={({ pressed }) => [
          styles.logoutButton,
          pressed && styles.logoutButtonPressed,
        ]}
      >
        <Text style={styles.logoutText}>Log out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxxl,
    paddingBottom: spacing.xl,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    // fontFamily et non fontWeight : la graisse d'une police custom se choisit
    // par la variante. Un fontWeight seul laisse le texte en police système,
    // sans erreur ni avertissement (cf. commentaire de typography).
    fontFamily: typography.family.heading,
    fontSize: typography.size.xl,
    color: colors.text,
  },
  logoutButton: {
    height: 48,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  logoutButtonPressed: {
    backgroundColor: colors.surface,
  },
  logoutText: {
    fontFamily: typography.family.bodySemibold,
    fontSize: typography.size.md,
    color: colors.danger,
  },
});
