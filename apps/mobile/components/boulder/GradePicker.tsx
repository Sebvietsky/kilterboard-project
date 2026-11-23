import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { GRADES } from '@/lib/grades/scale';
import { useGradeSystem } from '@/lib/grades/useGradeLabel';
import { colors, radii, spacing, typography } from '@/constants/theme';

// Sélecteur de cotation : grade ressenti (détail d'un bloc) et cotation d'un
// brouillon (création de bloc).
// Toujours en Font, l'échelle la plus fine : un vote en V ne dirait pas si
// c'est 6a ou 6a+, et fausserait la médiane. Un grimpeur en V lit son V en
// rappel sous chaque cotation.
export function GradePicker({
  selected,
  onSelect,
}: {
  selected: number | undefined;
  onSelect: (rank: number) => void;
}) {
  const showV = useGradeSystem() === 'V_SCALE';

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.gradeRow}
    >
      {GRADES.map((g) => {
        const active = selected === g.rank;
        return (
          <Pressable
            key={g.rank}
            onPress={() => onSelect(g.rank)}
            style={[styles.gradeChip, active && styles.gradeChipActive]}
          >
            <Text
              style={[
                styles.gradeChipText,
                active && styles.gradeChipTextActive,
              ]}
            >
              {g.font}
            </Text>
            {showV ? (
              <Text
                style={[
                  styles.gradeChipSubtext,
                  active && styles.gradeChipTextActive,
                ]}
              >
                {g.v}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  gradeRow: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  gradeChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  gradeChipActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  gradeChipText: {
    fontFamily: typography.family.heading,
    fontSize: typography.size.md,
    color: colors.text,
  },
  gradeChipTextActive: {
    color: colors.textOnInk,
  },
  gradeChipSubtext: {
    fontFamily: typography.family.data,
    fontSize: typography.size.xs,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
