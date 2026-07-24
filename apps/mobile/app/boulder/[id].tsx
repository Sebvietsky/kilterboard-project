import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import {
  colors,
  spacing,
  typography,
  radii,
  status as statusColors,
} from '@/constants/theme';
import { BoardLED } from '@/components/BoardLED';
import { useBoulder } from '@/lib/boulders/queries';
import { useMyAscentsOnBoulder } from '@/lib/ascents/queries';
import { AscentStatus } from '@/lib/ascents/types';
import { ApiError } from '@/lib/api/errors';

export default function BoulderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const boulderId = Number(id);
  const boulder = useBoulder(boulderId); // hooks appelés inconditionnellement
  const myAscents = useMyAscentsOnBoulder(boulderId);
  const statuses = myAscents.data?.map((a) => a.status) ?? [];
  const currentStatus = statuses.includes('FLASH')
    ? 'FLASH'
    : statuses.includes('SENT')
      ? 'SENT'
      : statuses.includes('PROJECT')
        ? 'PROJECT'
        : null;

  // id invalide OU 404 -> même écran "not found"
  if (
    !Number.isFinite(boulderId) ||
    (boulder.error instanceof ApiError && boulder.error.status === 404)
  ) {
    return (
      <View style={styles.centered}>
        <Text style={styles.stateTitle}>Boulder not found</Text>
      </View>
    );
  }

  // erreur générique + retry
  if (boulder.isError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.stateTitle}>Couldn&apos;t load this boulder</Text>
        <Pressable style={styles.retryButton} onPress={() => boulder.refetch()}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  // chargement (aucune donnée -> accès direct par URL)
  if (!boulder.data) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  // boulder.data garanti défini
  const detail = boulder.data;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.titleRow}>
        <View style={styles.titleLeft}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{detail.name}</Text>
            {currentStatus && <StatusBadge status={currentStatus} />}
          </View>
          <Text style={styles.setter}>by {detail.creatorUsername}</Text>
        </View>
        <View style={styles.gradeBlock}>
          <Text style={styles.grade}>{detail.gradeLabel}</Text>
          <Text style={styles.angle}>{detail.angleDegrees}°</Text>
        </View>
      </View>

      <BoardLED holds={detail.holds} />
    </ScrollView>
  );
}

function StatusBadge({ status }: { status: AscentStatus }) {
  const config = {
    FLASH: {
      label: 'Flash',
      box: styles.badgeFlash,
      text: styles.badgeTextFlash,
    },
    SENT: { label: 'Sent', box: styles.badgeSent, text: styles.badgeTextSent },
    PROJECT: {
      label: 'Project',
      box: styles.badgeProject,
      text: styles.badgeTextProject,
    },
  }[status];

  return (
    <View style={[styles.badgeBase, config.box]}>
      <Text style={[styles.badgeTextBase, config.text]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.xl,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.background,
  },
  stateTitle: {
    fontFamily: typography.family.heading,
    fontSize: typography.size.xl,
    color: colors.text,
    textAlign: 'center',
  },
  retryButton: {
    height: 48,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryText: {
    fontFamily: typography.family.bodySemibold,
    fontSize: typography.size.md,
    color: colors.surface,
  },
  // ── Header ──────────────────────────────────────────────
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  titleLeft: {
    flex: 1,
    gap: spacing.xs,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  name: {
    fontFamily: typography.family.display,
    fontSize: typography.size.xxl,
    color: colors.text,
  },
  gradeBlock: {
    alignItems: 'flex-end',
  },
  grade: {
    fontFamily: typography.family.heading,
    fontSize: typography.size.xxl,
    color: colors.primary,
  },
  angle: {
    fontFamily: typography.family.data,
    fontSize: typography.size.md,
    color: colors.textMuted,
  },
  setter: {
    fontFamily: typography.family.body,
    fontSize: typography.size.md,
    color: colors.textMuted,
  },
  // ── Status badge ────────────────────────────────────────
  badgeBase: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
  },
  badgeTextBase: {
    fontFamily: typography.family.bodySemibold,
    fontSize: typography.size.xs,
    textTransform: 'uppercase',
  },
  badgeFlash: {
    backgroundColor: statusColors.flash.badgeBg,
  },
  badgeTextFlash: {
    color: statusColors.flash.badgeText,
  },
  badgeSent: {
    backgroundColor: statusColors.ascent.badgeBg,
  },
  badgeTextSent: {
    color: statusColors.ascent.badgeText,
  },
  badgeProject: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: statusColors.project.badgeBorder,
  },
  badgeTextProject: {
    color: statusColors.project.badgeText,
  },
});
