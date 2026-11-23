import { StyleSheet, Text, View } from 'react-native';
import { GradeCircle } from '@/components/session/EntryRow';
import type { MyBoulder } from '@/lib/boulders/types';
import { relativeTime } from '@/lib/format/relativeTime';
import { useGradeLabel } from '@/lib/grades/useGradeLabel';
import { colors, radii, shadows, spacing, typography } from '@/constants/theme';

// Un bloc que j'ai publié : même ligne que l'historique des ascensions
// (cercle de cotation, nom, inclinaison et date), sans badge de statut.
export function MyBoulderRow({ boulder }: { boulder: MyBoulder }) {
  const formatGrade = useGradeLabel();
  const date = relativeTime(boulder.createdAt);

  return (
    <View style={styles.row}>
      <GradeCircle label={formatGrade(boulder.gradeRank)} />
      <View style={styles.rowText}>
        <Text style={styles.rowName} numberOfLines={1}>
          {boulder.name}
        </Text>
        <Text style={styles.rowMeta}>
          {date
            ? `${boulder.angleDegrees}° · ${date}`
            : `${boulder.angleDegrees}°`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.md,
    ...shadows.card,
  },
  rowText: {
    flex: 1,
    gap: spacing.xs,
  },
  rowName: {
    fontFamily: typography.family.heading,
    fontSize: typography.size.md,
    color: colors.text,
  },
  rowMeta: {
    fontFamily: typography.family.data,
    fontSize: typography.size.sm,
    color: colors.textMuted,
  },
});
