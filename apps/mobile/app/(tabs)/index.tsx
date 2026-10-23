import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { BoardCard } from '@/components/board/BoardCard';
import { colors, spacing, typography } from '@/constants/theme';

export default function HomeScreen() {
  const router = useRouter();

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <BoardCard />
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
  link: {
    alignSelf: 'center',
    fontFamily: typography.family.bodySemibold,
    fontSize: typography.size.sm,
    color: colors.primary,
  },
});
