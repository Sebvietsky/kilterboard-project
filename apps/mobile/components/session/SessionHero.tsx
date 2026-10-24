import { StyleSheet, Text, View } from 'react-native';
import { deriveSessionStats } from '@/lib/sessions/stats';
import type { SessionEntry } from '@/lib/sessions/types';
import { plural } from '@/lib/format/plural';
import { useGradeLabel } from '@/lib/grades/useGradeLabel';
import { colors, radii, spacing, typography } from '@/constants/theme';

/**
 * Carte de tête d'une session : un libellé, une grande valeur, une légende,
 * puis les stats tirées des passages.
 *
 * Purement présentationnelle : elle ne sait pas si la session tourne. La
 * session en cours lui passe le chrono, le détail d'une session passée sa
 * durée — même carte, mêmes stats, calculées au même endroit.
 */
export function SessionHero({
  label,
  active,
  value,
  caption,
  entries,
}: {
  label: string;
  // Point gold : couleur que le thème réserve à la session active.
  active?: boolean;
  value: string;
  caption: string;
  entries: SessionEntry[];
}) {
  const stats = deriveSessionStats(entries);
  const hardest = useGradeLabel()(stats.hardestRank);

  return (
    <View style={styles.card}>
      <View style={styles.labelRow}>
        {active ? <View style={styles.activeDot} /> : null}
        <Text style={styles.label}>{label}</Text>
      </View>

      <Text style={styles.value}>{value}</Text>
      <Text style={styles.caption}>{caption}</Text>

      <View style={styles.statsRow}>
        <StatChip label={plural(stats.climbs, 'climb')} />
        {hardest ? <StatChip label={`${hardest} hardest`} /> : null}
        {stats.flashes > 0 ? (
          <StatChip
            label={plural(stats.flashes, 'flash', 'flashes')}
            tone="flash"
          />
        ) : null}
        {stats.projectsSent > 0 ? (
          <StatChip
            label={`${plural(stats.projectsSent, 'project')} sent`}
            tone="project"
          />
        ) : null}
      </View>
    </View>
  );
}

// La teinte suit le code couleur des statuts partout dans l'app : gold pour
// un flash, coral pour un projet. Sans `tone`, une stat neutre.
function StatChip({
  label,
  tone,
}: {
  label: string;
  tone?: 'flash' | 'project';
}) {
  return (
    <View
      style={[
        styles.statChip,
        tone === 'flash' && styles.statChipFlash,
        tone === 'project' && styles.statChipProject,
      ]}
    >
      <Text
        style={[
          styles.statChipText,
          tone === 'flash' && styles.statChipTextFlash,
          tone === 'project' && styles.statChipTextProject,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.ink,
    borderRadius: radii.xl,
    padding: spacing.xl,
    gap: spacing.xs,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  activeDot: {
    width: spacing.sm,
    height: spacing.sm,
    borderRadius: radii.full,
    backgroundColor: colors.gold,
  },
  label: {
    fontFamily: typography.family.dataBold,
    fontSize: typography.size.xs,
    color: colors.sky,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  // tabular-nums : chiffres à chasse fixe, sinon le chrono tremble à chaque
  // seconde (un « 1 » est plus étroit qu'un « 8 »).
  value: {
    fontFamily: typography.family.dataBold,
    fontSize: typography.size.display + typography.size.md,
    fontVariant: ['tabular-nums'],
    color: colors.textOnInk,
  },
  caption: {
    fontFamily: typography.family.body,
    fontSize: typography.size.sm,
    color: colors.textSubtle,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  statChip: {
    backgroundColor: colors.chipOnInk,
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  statChipFlash: {
    backgroundColor: colors.chipOnInkFlash,
  },
  statChipProject: {
    backgroundColor: colors.chipOnInkProject,
  },
  statChipText: {
    fontFamily: typography.family.data,
    fontSize: typography.size.sm,
    color: colors.sky,
  },
  statChipTextFlash: {
    color: colors.gold,
  },
  statChipTextProject: {
    color: colors.coral,
  },
});
