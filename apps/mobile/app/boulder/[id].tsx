import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  ScrollView,
  TextInput,
  Switch,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import {
  colors,
  spacing,
  typography,
  radii,
  shadows,
  status as statusColors,
} from '@/constants/theme';
import { BoardLED } from '@/components/BoardLED';
import { useBoulder } from '@/lib/boulders/queries';
import {
  deriveAvailableStatuses,
  useLogAscent,
  useMyAscentsOnBoulder,
} from '@/lib/ascents/queries';
import { AscentStatus } from '@/lib/ascents/types';
import { useGrades } from '@/lib/grades/queries';
import { Grade } from '@/lib/grades/types';
import { ApiError } from '@/lib/api/errors';
import { relativeTime } from '@/lib/format/relativeTime';
import { useState } from 'react';

export default function BoulderDetailScreen() {
  const [logStatus, setLogStatus] = useState<AscentStatus | null>(null);
  const [attempts, setAttempts] = useState(1);
  const [feltGradeRank, setFeltGradeRank] = useState<number>();
  const [comment, setComment] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [rating, setRating] = useState<number>();

  const { id } = useLocalSearchParams<{ id: string }>();
  const boulderId = Number(id);
  const boulder = useBoulder(boulderId); // hooks appelés inconditionnellement
  const myAscents = useMyAscentsOnBoulder(boulderId);
  const grades = useGrades();
  const logAscent = useLogAscent();
  const statuses = myAscents.data?.map((a) => a.status) ?? [];
  const currentStatus = statuses.includes('FLASH')
    ? 'FLASH'
    : statuses.includes('SENT')
      ? 'SENT'
      : statuses.includes('PROJECT')
        ? 'PROJECT'
        : null;
  const availableStatuses = deriveAvailableStatuses(myAscents.data ?? []);
  // La sélection ne survit pas à un changement de disponibilité : myAscents peut
  // se refetch hors du submit (retour de focus, autre appareil) et rendre le
  // statut choisi impossible. Sans cette garde, plus aucun segment n'est actif
  // et le stepper disparaît, sans erreur ni log.
  const selectedStatus =
    (logStatus && availableStatuses.includes(logStatus) ? logStatus : null) ??
    availableStatuses[0] ??
    null;

  // Note publique = uniquement au premier envoi (SENT/FLASH sans historique).
  const hasAnyAscent = (myAscents.data ?? []).length > 0;
  const canBePublic =
    !hasAnyAscent && (selectedStatus === 'SENT' || selectedStatus === 'FLASH');

  const feltGradeRequired =
    !hasAnyAscent && (selectedStatus === 'FLASH' || selectedStatus === 'SENT');
  const canSubmit =
    !!selectedStatus &&
    !(feltGradeRequired && feltGradeRank == null) &&
    !logAscent.isPending;

  function submit() {
    if (!selectedStatus) return;
    logAscent.mutate(
      {
        boulderId,
        status: selectedStatus,
        attemptsCount: selectedStatus === 'FLASH' ? 1 : attempts,
        feltGradeRank: selectedStatus === 'PROJECT' ? undefined : feltGradeRank,
        rating: selectedStatus === 'PROJECT' ? undefined : rating,
        comment: comment.trim() || undefined,
        visibility: canBePublic && isPublic ? 'PUBLIC' : 'PRIVATE',
      },
      {
        onSuccess: () => {
          setLogStatus(null);
          setAttempts(1);
          setFeltGradeRank(undefined);
          setRating(undefined);
          setComment('');
        },
      },
    );
  }

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

      <View style={styles.statsCard}>
        <View style={styles.statCol}>
          <Text style={styles.statLabel}>Rating</Text>
          <Text style={styles.statValue}>
            {detail.averageRating !== null ? (
              <>
                <Text style={styles.star}>★</Text>{' '}
                {detail.averageRating.toFixed(1)}
              </>
            ) : (
              '—'
            )}
          </Text>
        </View>

        <View style={styles.statDivider} />

        <View style={styles.statCol}>
          <Text style={styles.statLabel}>Ascents</Text>
          <Text style={styles.statValue}>{detail.ascentCount}</Text>
        </View>

        {detail.tags.length > 0 && (
          <>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text style={styles.statLabel}>Tags</Text>
              <View style={styles.tagWrap}>
                {detail.tags.map((tag) => (
                  <View key={tag} style={styles.tag}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            </View>
          </>
        )}
      </View>

      <View style={styles.logSection}>
        <Text style={styles.sectionLabel}>Log session</Text>
        {availableStatuses.length === 0 ? (
          <Text style={styles.placeholderText}>
            You have an active project on this boulder. Finish it from the
            Library tab.
          </Text>
        ) : (
          <>
            {hasAnyAscent && (
              <Text style={styles.logHint}>
                You&apos;ve already logged this boulder — log a repeat below.
              </Text>
            )}
            <StatusSegmented
              available={availableStatuses}
              selected={selectedStatus}
              onSelect={setLogStatus}
            />

            {selectedStatus !== 'FLASH' && (
              <View style={styles.fieldRow}>
                <View>
                  <Text style={styles.fieldLabel}>Attempts</Text>
                  <Text style={styles.fieldHint}>Number of tries</Text>
                </View>
                <Stepper value={attempts} onChange={setAttempts} />
              </View>
            )}

            {feltGradeRequired && (
              <View style={styles.field}>
                <View style={styles.fieldHeader}>
                  <View>
                    <Text style={styles.fieldLabel}>Felt grade</Text>
                    <Text style={styles.fieldHint}>Your assessment</Text>
                  </View>
                  <Text
                    style={[
                      styles.required,
                      feltGradeRank == null && styles.requiredEmpty,
                    ]}
                  >
                    Required
                  </Text>
                </View>
                <GradePicker
                  grades={grades.data ?? []}
                  selected={feltGradeRank}
                  onSelect={setFeltGradeRank}
                />
              </View>
            )}

            {feltGradeRequired && (
              <View style={styles.field}>
                <View style={styles.fieldHeader}>
                  <View>
                    <Text style={styles.fieldLabel}>Rate this climb</Text>
                    <Text style={styles.fieldHint}>Optional</Text>
                  </View>
                </View>
                <StarRating value={rating} onChange={setRating} />
              </View>
            )}

            <View style={styles.field}>
              <View style={styles.fieldHeader}>
                <Text style={styles.fieldLabel}>Comment</Text>
                {canBePublic ? (
                  <View style={styles.toggleRow}>
                    <Text style={styles.toggleLabel}>
                      {isPublic ? 'Public' : 'Private'}
                    </Text>
                    <Switch
                      value={isPublic}
                      onValueChange={setIsPublic}
                      trackColor={{
                        true: colors.primary,
                        false: colors.border,
                      }}
                    />
                  </View>
                ) : (
                  <Text style={styles.privateLabel}>Private only</Text>
                )}
              </View>
              <TextInput
                style={styles.commentInput}
                value={comment}
                onChangeText={setComment}
                placeholder="How did it feel? (beta, conditions, energy...)"
                placeholderTextColor={colors.textSubtle}
                multiline
              />
            </View>

            {logAscent.isError && (
              <Text style={styles.errorText}>{logAscent.error.message}</Text>
            )}

            <Pressable
              onPress={submit}
              disabled={!canSubmit}
              style={[
                styles.submitButton,
                !canSubmit && styles.submitButtonDisabled,
              ]}
            >
              <Text
                style={[
                  styles.submitText,
                  !canSubmit && styles.submitTextDisabled,
                ]}
              >
                {logAscent.isPending
                  ? 'Logging…'
                  : selectedStatus === 'PROJECT'
                    ? 'Save'
                    : 'Log ascent'}
              </Text>
            </Pressable>
          </>
        )}
      </View>

      <View style={styles.notesSection}>
        <Text style={styles.sectionLabel}>Community notes</Text>

        {/* L'état vide n'est affiché qu'une fois la vraie réponse arrivée :
            le placeholderData de useBoulder pose publicNotes: [] en dur, donc
            en venant d'Explore on annoncerait « No notes yet » sur un bloc qui
            en a. Pendant ce temps, on ne montre rien plutôt qu'un mensonge. */}
        {detail.publicNotes.length === 0 ? (
          boulder.isPlaceholderData ? null : (
            <Text style={styles.placeholderText}>No notes yet.</Text>
          )
        ) : (
          detail.publicNotes.map((note) => (
            // Clé sur username : le backend n'expose pas d'id de note, mais
            // interdit plus d'une note publique par (utilisateur, bloc) — le
            // pseudo est donc unique dans cette liste. Si cette règle tombe,
            // les clés entrent en collision SANS erreur : React réutilisera
            // simplement le mauvais nœud.
            <View key={note.username} style={styles.noteCard}>
              <View style={styles.noteHeader}>
                <Text style={styles.noteAuthor} numberOfLines={1}>
                  {note.username}
                </Text>
                <View style={styles.noteMeta}>
                  {note.feltGradeLabel !== null && (
                    <View style={styles.noteGrade}>
                      <Text style={styles.noteGradeText}>
                        {note.feltGradeLabel}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.noteDate}>
                    {relativeTime(note.createdAt)}
                  </Text>
                </View>
              </View>
              <Text style={styles.noteContent}>{note.content}</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const ALL_STATUSES: { value: AscentStatus; label: string }[] = [
  { value: 'FLASH', label: 'Flash' },
  { value: 'SENT', label: 'Sent' },
  { value: 'PROJECT', label: 'Project' },
];

function StatusSegmented({
  available,
  selected,
  onSelect,
}: {
  available: AscentStatus[];
  selected: AscentStatus | null;
  onSelect: (status: AscentStatus) => void;
}) {
  // Recette visuelle du segment sélectionné, par statut (même pattern que
  // StatusBadge) : le contrôle parle la même langue que la pastille du header.
  const segmentStyles = {
    FLASH: { box: styles.segmentFlash, text: styles.segmentTextFlash },
    SENT: { box: styles.segmentSent, text: styles.segmentTextSent },
    PROJECT: { box: styles.segmentProject, text: styles.segmentTextProject },
  };

  return (
    <View style={styles.segmented}>
      {ALL_STATUSES.map(({ value, label }) => {
        const disabled = !available.includes(value);
        const active = selected === value;
        const config = segmentStyles[value];
        return (
          <Pressable
            key={value}
            disabled={disabled}
            onPress={() => onSelect(value)}
            style={[
              styles.segment,
              active && styles.segmentActive,
              active && config.box,
              disabled && styles.segmentDisabled,
            ]}
          >
            <Text style={[styles.segmentText, active && config.text]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function StarRating({
  value,
  onChange,
}: {
  value: number | undefined;
  onChange: (n: number) => void;
}) {
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable key={n} onPress={() => onChange(n)} hitSlop={spacing.xs}>
          <Text
            style={[
              styles.starIcon,
              value != null && n <= value && styles.starIconActive,
            ]}
          >
            ★
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function GradePicker({
  grades,
  selected,
  onSelect,
}: {
  grades: Grade[];
  selected: number | undefined;
  onSelect: (rank: number) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.gradeRow}
    >
      {grades.map((g) => {
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
              {g.vScale}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function Stepper({
  value,
  onChange,
  min = 1,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
}) {
  return (
    <View style={styles.stepper}>
      <Pressable
        style={styles.stepperBtn}
        onPress={() => onChange(Math.max(min, value - 1))}
      >
        <Text style={styles.stepperSign}>−</Text>
      </Pressable>
      <Text style={styles.stepperValue}>{value}</Text>
      <Pressable style={styles.stepperBtn} onPress={() => onChange(value + 1)}>
        <Text style={styles.stepperSign}>+</Text>
      </Pressable>
    </View>
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
  // ── Stats card ──────────────────────────────────────────
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    paddingVertical: spacing.lg,
    ...shadows.card,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  statDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: colors.border,
  },
  statLabel: {
    fontFamily: typography.family.data,
    fontSize: typography.size.xs,
    letterSpacing: 1,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  statValue: {
    fontFamily: typography.family.data,
    fontSize: typography.size.lg,
    color: colors.text,
  },
  star: {
    color: colors.gold,
  },
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  tag: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  tagText: {
    fontFamily: typography.family.data,
    fontSize: typography.size.xs,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  // ── Log session ─────────────────────────────────────────
  logSection: {
    gap: spacing.md,
  },
  sectionLabel: {
    fontFamily: typography.family.data,
    fontSize: typography.size.xs,
    letterSpacing: 1,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  placeholderText: {
    fontFamily: typography.family.body,
    fontSize: typography.size.md,
    color: colors.textMuted,
  },
  logHint: {
    fontFamily: typography.family.body,
    fontSize: typography.size.sm,
    color: colors.textMuted,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.card,
    padding: spacing.xs,
  },
  segment: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radii.md,
  },
  // Le fond du segment actif vient de son statut (voir segmentFlash & co.) ;
  // ici seulement le relief qui le détache du conteneur.
  segmentActive: {
    ...shadows.card,
  },
  // Indisponible : l'opacité porte sur tout le segment, pas sur le seul texte —
  // un segment translucide se lit « hors service », un texte plus clair se lit
  // « pas sélectionné ».
  segmentDisabled: {
    opacity: 0.4,
  },
  segmentFlash: {
    backgroundColor: statusColors.flash.softBg,
  },
  segmentSent: {
    backgroundColor: statusColors.ascent.softBg,
  },
  segmentProject: {
    backgroundColor: statusColors.project.softBg,
  },
  segmentText: {
    fontFamily: typography.family.bodySemibold,
    fontSize: typography.size.md,
    color: colors.textMuted,
  },
  segmentTextFlash: {
    color: statusColors.flash.badgeText,
  },
  segmentTextSent: {
    color: statusColors.ascent.badgeText,
  },
  segmentTextProject: {
    color: statusColors.project.badgeText,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldLabel: {
    fontFamily: typography.family.heading,
    fontSize: typography.size.lg,
    color: colors.text,
  },
  fieldHint: {
    fontFamily: typography.family.data,
    fontSize: typography.size.xs,
    letterSpacing: 1,
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    paddingHorizontal: spacing.xs,
  },
  stepperBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperSign: {
    fontFamily: typography.family.heading,
    fontSize: typography.size.xl,
    color: colors.primary,
  },
  stepperValue: {
    fontFamily: typography.family.data,
    fontSize: typography.size.lg,
    color: colors.text,
    minWidth: 28,
    textAlign: 'center',
  },
  field: {
    gap: spacing.sm,
  },
  fieldHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  required: {
    fontFamily: typography.family.data,
    fontSize: typography.size.xs,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textSubtle,
  },
  requiredEmpty: {
    color: colors.coral,
  },
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
    color: colors.surface,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  toggleLabel: {
    fontFamily: typography.family.data,
    fontSize: typography.size.xs,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  privateLabel: {
    fontFamily: typography.family.data,
    fontSize: typography.size.xs,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textSubtle,
  },
  commentInput: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    fontFamily: typography.family.body,
    fontSize: typography.size.md,
    color: colors.text,
    backgroundColor: colors.surface,
    textAlignVertical: 'top',
  },
  errorText: {
    fontFamily: typography.family.body,
    fontSize: typography.size.sm,
    color: colors.coral,
  },
  submitButton: {
    height: 52,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: colors.surfaceMuted,
  },
  submitText: {
    fontFamily: typography.family.bodySemibold,
    fontSize: typography.size.md,
    color: colors.surface,
  },
  submitTextDisabled: {
    color: colors.textSubtle,
  },
  starRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    alignSelf: 'flex-start',
  },
  starIcon: {
    fontSize: 28,
    color: colors.border,
  },
  starIconActive: {
    color: colors.gold,
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
  // ── Community notes ─────────────────────────────────────
  notesSection: {
    gap: spacing.md,
  },
  // Une carte par note, même recette que statsCard : c'est la surface qui
  // sépare les commentaires, pas un filet ni un liseré d'accent (interdits DA).
  noteCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadows.card,
  },
  noteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  // flexShrink et non flex: 1 — l'auteur ne prend que la place qu'il lui faut,
  // mais cède devant la pastille et la date plutôt que de les pousser hors du
  // cadre quand le pseudo est long (numberOfLines l'ellipse alors).
  noteAuthor: {
    flexShrink: 1,
    fontFamily: typography.family.bodySemibold,
    fontSize: typography.size.md,
    color: colors.text,
  },
  noteMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  // Pastille de cotation proposée : reprend primaryMuted/primary de la
  // cotation officielle en tête d'écran, en plus petit — même nature
  // d'information, poids visuel moindre. C'est un avis, pas la référence.
  noteGrade: {
    backgroundColor: colors.primaryMuted,
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  noteGradeText: {
    fontFamily: typography.family.data,
    fontSize: typography.size.xs,
    color: colors.primary,
  },
  noteDate: {
    fontFamily: typography.family.data,
    fontSize: typography.size.xs,
    color: colors.textSubtle,
  },
  noteContent: {
    fontFamily: typography.family.body,
    fontSize: typography.size.md,
    lineHeight: typography.size.md * typography.lineHeight.normal,
    color: colors.text,
  },
});
