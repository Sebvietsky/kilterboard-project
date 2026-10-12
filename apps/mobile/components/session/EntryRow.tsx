import { StyleSheet, Text, View } from 'react-native';
import type { SessionEntry } from '@/lib/sessions/types';
import { formatClockTime } from '@/lib/format/clockTime';
import { plural } from '@/lib/format/plural';
import {
  colors,
  radii,
  shadows,
  spacing,
  status as statusColors,
  typography,
} from '@/constants/theme';

const GRADE_CIRCLE_SIZE = spacing.xxl + spacing.sm;

// Une ligne du journal d'une session : heure, cotation, bloc, résultat du
// passage. Partagée par la session en cours et par le détail d'une session
// passée, qui affichent exactement la même donnée.
export function EntryRow({ entry }: { entry: SessionEntry }) {
  const { boulder } = entry.ascent;

  return (
    <View style={styles.row}>
      <Text style={styles.rowTime}>{formatClockTime(entry.createdAt)}</Text>
      <GradeCircle
        label={boulder.grade.vScale}
        muted={entry.status === 'PROJECT'}
      />
      <Text style={styles.rowName} numberOfLines={1}>
        {boulder.name}
      </Text>
      <EntryBadge entry={entry} />
    </View>
  );
}

// Le badge dit ce qui s'est passé CETTE fois : flash, envoi en n essais, ou
// n essais sans envoi. Les essais sont ceux du passage, pas le cumul du projet.
function EntryBadge({ entry }: { entry: SessionEntry }) {
  const tries =
    entry.attempts > 0 ? plural(entry.attempts, 'try', 'tries') : '';

  if (entry.status === 'FLASH')
    return <StatusBadge tone="flash" label="Flash" />;
  if (entry.status === 'SENT') {
    return <StatusBadge tone="sent" label={tries || 'Sent'} />;
  }
  return (
    <StatusBadge tone="project" label={tries ? `${tries} → Proj.` : 'Proj.'} />
  );
}

export function StatusBadge({
  tone,
  label,
}: {
  tone: 'flash' | 'sent' | 'project';
  label: string;
}) {
  return (
    <View style={[styles.badge, BADGE_STYLES[tone].container]}>
      <Text style={[styles.badgeText, BADGE_STYLES[tone].text]}>{label}</Text>
    </View>
  );
}

export function GradeCircle({
  label,
  muted,
}: {
  label: string;
  muted?: boolean;
}) {
  return (
    <View style={[styles.gradeCircle, muted && styles.gradeCircleMuted]}>
      <Text style={[styles.gradeText, muted && styles.gradeTextMuted]}>
        {label}
      </Text>
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
  rowTime: {
    fontFamily: typography.family.data,
    fontSize: typography.size.xs,
    fontVariant: ['tabular-nums'],
    color: colors.textSubtle,
  },
  rowName: {
    flex: 1,
    fontFamily: typography.family.heading,
    fontSize: typography.size.md,
    color: colors.text,
  },
  gradeCircle: {
    width: GRADE_CIRCLE_SIZE,
    height: GRADE_CIRCLE_SIZE,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryMuted,
  },
  // Bloc pas (encore) envoyé : la cotation passe en retrait.
  gradeCircleMuted: {
    backgroundColor: colors.surfaceMuted,
  },
  gradeText: {
    fontFamily: typography.family.heading,
    fontSize: typography.size.sm,
    color: colors.primary,
  },
  gradeTextMuted: {
    color: colors.textMuted,
  },
  badge: {
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  badgeText: {
    fontFamily: typography.family.dataBold,
    fontSize: typography.size.xs,
    textTransform: 'uppercase',
  },
  badgeFlash: {
    backgroundColor: statusColors.flash.badgeBg,
  },
  badgeFlashText: {
    color: statusColors.flash.badgeText,
  },
  badgeSent: {
    backgroundColor: statusColors.ascent.badgeBg,
  },
  badgeSentText: {
    color: statusColors.ascent.badgeText,
  },
  // Projet : fond transparent et bordure en pointillés, recette du thème.
  badgeProject: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: statusColors.project.badgeBorder,
  },
  badgeProjectText: {
    color: statusColors.project.badgeText,
  },
});

const BADGE_STYLES = {
  flash: { container: styles.badgeFlash, text: styles.badgeFlashText },
  sent: { container: styles.badgeSent, text: styles.badgeSentText },
  project: { container: styles.badgeProject, text: styles.badgeProjectText },
} as const;
