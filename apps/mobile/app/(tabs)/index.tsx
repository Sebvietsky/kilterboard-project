import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { Plus } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { BoardCard } from '@/components/board/BoardCard';
import { colors, radii, spacing, typography } from '@/constants/theme';

const ICON_SIZE = spacing.xl - spacing.xs;

export default function HomeScreen() {
  const router = useRouter();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <BoardCard />
      {/* Même écran que le + de Library → Drafts. */}
      <Pressable
        onPress={() => router.push('/draft/new')}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.createButton,
          pressed && styles.createButtonPressed,
        ]}
      >
        <Plus size={ICON_SIZE} color={colors.textOnPrimary} />
        <Text style={styles.createText}>Create a boulder</Text>
      </Pressable>
      {/* Accès temporaire à l'essai BLE en salle, à supprimer avec l'écran. */}
      <Pressable onPress={() => router.push('/ble-spike')}>
        <Text style={styles.link}>BLE test</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radii.full,
    paddingVertical: spacing.md,
  },
  createButtonPressed: {
    backgroundColor: colors.primaryPressed,
  },
  createText: {
    fontFamily: typography.family.bodySemibold,
    fontSize: typography.size.md,
    color: colors.textOnPrimary,
  },
  link: {
    alignSelf: 'center',
    fontFamily: typography.family.bodySemibold,
    fontSize: typography.size.sm,
    color: colors.primary,
  },
});
