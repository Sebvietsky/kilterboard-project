import { StyleSheet, Text, View } from 'react-native';
import type { MyAscentHistoryItem } from '@/lib/ascents/types';
import { GradeCircle, StatusBadge } from '@/components/session/EntryRow';
import { plural } from '@/lib/format/plural';
import { relativeTime } from '@/lib/format/relativeTime';
import { colors, radii, shadows, spacing, typography } from '@/constants/theme';

// Une ascension de l'historique. Un second envoi étant un nouveau SENT, le
// même bloc à la même inclinaison peut revenir. Mêmes briques que le passage
// de session (cercle de cotation, badge), mais le badge dit le cumul de
// l'ascension et non une séance.
export function AscentHistoryRow({ ascent }: { ascent: MyAscentHistoryItem }) {
  // Date de l'envoi s'il a eu lieu, sinon celle de l'ouverture du projet.
  const date = relativeTime(ascent.sendDate ?? ascent.createdAt);

  return (
    <View style={styles.row}>
      <GradeCircle
        label={ascent.boulderAngle.grade?.vScale ?? null}
        muted={ascent.status === 'PROJECT'}
      />
      <View style={styles.rowText}>
        <Text style={styles.rowName} numberOfLines={1}>
          {ascent.boulder.name}
        </Text>
        <Text style={styles.rowMeta}>
          {date
            ? `${ascent.angle.valueDegrees}° · ${date}`
            : `${ascent.angle.valueDegrees}°`}
        </Text>
      </View>
      <AscentBadge ascent={ascent} />
    </View>
  );
}

function AscentBadge({ ascent }: { ascent: MyAscentHistoryItem }) {
  const tries =
    ascent.attemptsCount > 0
      ? plural(ascent.attemptsCount, 'try', 'tries')
      : '';

  if (ascent.status === 'FLASH')
    return <StatusBadge tone="flash" label="Flash" />;
  if (ascent.status === 'SENT')
    return <StatusBadge tone="sent" label={tries || 'Sent'} />;
  return <StatusBadge tone="project" label="Proj." />;
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
